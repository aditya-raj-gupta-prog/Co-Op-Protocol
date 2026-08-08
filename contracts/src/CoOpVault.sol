// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CoOpVault
/// @notice Multi-member treasury vaults with threshold-approved expense payouts.
/// @dev Each workspace holds an isolated balance in `treasuryOf`. The contract exposes no
///      `receive`/`fallback`, so `address(this).balance` always equals the sum of every
///      workspace treasury and funds can never be stranded outside the accounting.
contract CoOpVault is Ownable, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    struct Workspace {
        uint256 id;
        string name;
        uint256 approvalThreshold;
        uint256 memberCount;
        bool active;
    }

    struct ExpenseRequest {
        uint256 id;
        uint256 workspaceId;
        address payable recipient;
        uint256 amount;
        string metadataHash;
        uint256 approvalsCount;
        bool executed;
        bool rejected;
    }

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error EmptyName();
    error ZeroAddressMember();
    error InvalidThreshold(uint256 threshold, uint256 memberCount);
    error WorkspaceNotFound(uint256 workspaceId);
    error WorkspaceInactive(uint256 workspaceId);
    error NotWorkspaceMember(uint256 workspaceId, address account);
    error ZeroDeposit();
    error ZeroAmount();
    error InvalidRecipient();
    error ExpenseNotFound(uint256 expenseId);
    error ExpenseNotPending(uint256 expenseId);
    error AlreadyApproved(uint256 expenseId, address account);
    error ThresholdNotMet(uint256 approvalsCount, uint256 approvalThreshold);
    error InsufficientTreasury(uint256 available, uint256 requested);
    error NotAuthorized(address account);
    error TransferFailed(uint256 expenseId, address recipient, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event WorkspaceCreated(
        uint256 indexed workspaceId,
        address indexed creator,
        string name,
        uint256 approvalThreshold,
        uint256 memberCount
    );
    event MemberAdded(uint256 indexed workspaceId, address indexed member);
    event WorkspaceStatusChanged(uint256 indexed workspaceId, bool active);
    event Deposited(uint256 indexed workspaceId, address indexed from, uint256 amount, uint256 newBalance);
    event ExpenseCreated(
        uint256 indexed expenseId,
        uint256 indexed workspaceId,
        address indexed recipient,
        address proposer,
        uint256 amount,
        string metadataHash
    );
    event ExpenseApproved(uint256 indexed expenseId, address indexed approver, uint256 approvalsCount);
    event ExpenseExecuted(uint256 indexed expenseId, address indexed recipient, uint256 amount);
    event ExpenseRejected(uint256 indexed expenseId, address indexed rejectedBy);

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Number of workspaces ever created; ids are 1-indexed.
    uint256 public workspaceCount;
    /// @notice Number of expense requests ever created; ids are 1-indexed.
    uint256 public expenseCount;

    /// @notice Native-currency balance held on behalf of each workspace.
    mapping(uint256 workspaceId => uint256 balance) public treasuryOf;
    /// @notice Membership lookup: workspace id => account => is a member.
    mapping(uint256 workspaceId => mapping(address account => bool)) public isMember;
    /// @notice Vote lookup: expense id => account => has already approved.
    mapping(uint256 expenseId => mapping(address account => bool)) public hasApproved;
    /// @notice Account that proposed a given expense request.
    mapping(uint256 expenseId => address proposer) public proposerOf;

    mapping(uint256 workspaceId => Workspace) private _workspaces;
    mapping(uint256 expenseId => ExpenseRequest) private _expenses;
    mapping(uint256 workspaceId => address[] members) private _members;

    constructor() Ownable(msg.sender) {}

    /*//////////////////////////////////////////////////////////////
                               WORKSPACES
    //////////////////////////////////////////////////////////////*/

    /// @notice Creates a workspace. The caller is always registered as a member.
    /// @param name Human readable workspace label; must be non-empty.
    /// @param initialMembers Additional members to register. Duplicates are ignored.
    /// @param threshold Approvals required to release an expense; must be in [1, memberCount].
    /// @return workspaceId Id of the newly created workspace.
    function createWorkspace(string memory name, address[] memory initialMembers, uint256 threshold)
        external
        returns (uint256 workspaceId)
    {
        if (bytes(name).length == 0) revert EmptyName();

        workspaceId = ++workspaceCount;

        Workspace storage ws = _workspaces[workspaceId];
        ws.id = workspaceId;
        ws.name = name;
        ws.active = true;

        _addMember(workspaceId, msg.sender);

        for (uint256 i = 0; i < initialMembers.length; ++i) {
            address member = initialMembers[i];
            if (member == address(0)) revert ZeroAddressMember();
            if (!isMember[workspaceId][member]) _addMember(workspaceId, member);
        }

        uint256 memberCount = ws.memberCount;
        if (threshold == 0 || threshold > memberCount) revert InvalidThreshold(threshold, memberCount);
        ws.approvalThreshold = threshold;

        emit WorkspaceCreated(workspaceId, msg.sender, name, threshold, memberCount);
    }

    /// @notice Enables or disables a workspace. Inactive workspaces reject deposits and new expenses.
    /// @dev Expenses already approved before deactivation stay executable so funds are never trapped.
    function setWorkspaceActive(uint256 workspaceId, bool active) external onlyOwner {
        _requireWorkspaceExists(workspaceId);
        _workspaces[workspaceId].active = active;
        emit WorkspaceStatusChanged(workspaceId, active);
    }

    /*//////////////////////////////////////////////////////////////
                                TREASURY
    //////////////////////////////////////////////////////////////*/

    /// @notice Funds a workspace treasury with native currency. Open to any address.
    function deposit(uint256 workspaceId) external payable {
        _requireWorkspaceActive(workspaceId);
        if (msg.value == 0) revert ZeroDeposit();

        uint256 newBalance = treasuryOf[workspaceId] + msg.value;
        treasuryOf[workspaceId] = newBalance;

        emit Deposited(workspaceId, msg.sender, msg.value, newBalance);
    }

    /*//////////////////////////////////////////////////////////////
                                EXPENSES
    //////////////////////////////////////////////////////////////*/

    /// @notice Proposes an expense against a workspace treasury. Members only.
    /// @param metadataHash IPFS CID or URI describing the expense (receipt, invoice, task link).
    /// @return expenseId Id of the newly created expense request.
    function createExpense(uint256 workspaceId, address payable recipient, uint256 amount, string memory metadataHash)
        external
        returns (uint256 expenseId)
    {
        _requireWorkspaceActive(workspaceId);
        if (!isMember[workspaceId][msg.sender]) revert NotWorkspaceMember(workspaceId, msg.sender);
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert ZeroAmount();

        expenseId = ++expenseCount;

        _expenses[expenseId] = ExpenseRequest({
            id: expenseId,
            workspaceId: workspaceId,
            recipient: recipient,
            amount: amount,
            metadataHash: metadataHash,
            approvalsCount: 0,
            executed: false,
            rejected: false
        });
        proposerOf[expenseId] = msg.sender;

        emit ExpenseCreated(expenseId, workspaceId, recipient, msg.sender, amount, metadataHash);
    }

    /// @notice Casts a single approval vote for a pending expense.
    /// @dev Auto-executes the payout once the threshold is reached and the treasury can cover it.
    ///      If the treasury is short the request stays pending and `executeExpense` can settle it later.
    function approveExpense(uint256 expenseId) external nonReentrant {
        ExpenseRequest storage expense = _requireExpensePending(expenseId);

        uint256 workspaceId = expense.workspaceId;
        if (!isMember[workspaceId][msg.sender]) revert NotWorkspaceMember(workspaceId, msg.sender);
        if (hasApproved[expenseId][msg.sender]) revert AlreadyApproved(expenseId, msg.sender);

        hasApproved[expenseId][msg.sender] = true;
        uint256 approvalsCount = expense.approvalsCount + 1;
        expense.approvalsCount = approvalsCount;

        emit ExpenseApproved(expenseId, msg.sender, approvalsCount);

        if (approvalsCount >= _workspaces[workspaceId].approvalThreshold && treasuryOf[workspaceId] >= expense.amount) {
            _execute(expenseId, expense);
        }
    }

    /// @notice Releases funds for an expense that already met its approval threshold.
    function executeExpense(uint256 expenseId) external nonReentrant {
        ExpenseRequest storage expense = _requireExpensePending(expenseId);

        uint256 threshold = _workspaces[expense.workspaceId].approvalThreshold;
        if (expense.approvalsCount < threshold) revert ThresholdNotMet(expense.approvalsCount, threshold);

        _execute(expenseId, expense);
    }

    /// @notice Cancels a pending expense. Callable by its proposer or the contract owner.
    function rejectExpense(uint256 expenseId) external {
        ExpenseRequest storage expense = _requireExpensePending(expenseId);
        if (msg.sender != proposerOf[expenseId] && msg.sender != owner()) revert NotAuthorized(msg.sender);

        expense.rejected = true;
        emit ExpenseRejected(expenseId, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    function getWorkspace(uint256 workspaceId) external view returns (Workspace memory) {
        _requireWorkspaceExists(workspaceId);
        return _workspaces[workspaceId];
    }

    function getExpense(uint256 expenseId) external view returns (ExpenseRequest memory) {
        if (expenseId == 0 || expenseId > expenseCount) revert ExpenseNotFound(expenseId);
        return _expenses[expenseId];
    }

    function getMembers(uint256 workspaceId) external view returns (address[] memory) {
        _requireWorkspaceExists(workspaceId);
        return _members[workspaceId];
    }

    /// @notice True when an expense is neither executed nor rejected.
    function isExpensePending(uint256 expenseId) external view returns (bool) {
        if (expenseId == 0 || expenseId > expenseCount) return false;
        ExpenseRequest storage expense = _expenses[expenseId];
        return !expense.executed && !expense.rejected;
    }

    /*//////////////////////////////////////////////////////////////
                                INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _addMember(uint256 workspaceId, address member) private {
        isMember[workspaceId][member] = true;
        _members[workspaceId].push(member);
        unchecked {
            _workspaces[workspaceId].memberCount += 1;
        }
        emit MemberAdded(workspaceId, member);
    }

    /// @dev Checks-effects-interactions: the treasury is debited before the transfer, and the
    ///      public entrypoints are `nonReentrant`, so a hostile recipient cannot double-spend.
    function _execute(uint256 expenseId, ExpenseRequest storage expense) private {
        uint256 amount = expense.amount;
        uint256 workspaceId = expense.workspaceId;
        uint256 balance = treasuryOf[workspaceId];
        if (balance < amount) revert InsufficientTreasury(balance, amount);

        expense.executed = true;
        unchecked {
            treasuryOf[workspaceId] = balance - amount;
        }

        address payable recipient = expense.recipient;
        emit ExpenseExecuted(expenseId, recipient, amount);

        (bool ok,) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed(expenseId, recipient, amount);
    }

    function _requireWorkspaceExists(uint256 workspaceId) private view {
        if (workspaceId == 0 || workspaceId > workspaceCount) revert WorkspaceNotFound(workspaceId);
    }

    function _requireWorkspaceActive(uint256 workspaceId) private view {
        _requireWorkspaceExists(workspaceId);
        if (!_workspaces[workspaceId].active) revert WorkspaceInactive(workspaceId);
    }

    function _requireExpensePending(uint256 expenseId) private view returns (ExpenseRequest storage expense) {
        if (expenseId == 0 || expenseId > expenseCount) revert ExpenseNotFound(expenseId);
        expense = _expenses[expenseId];
        if (expense.executed || expense.rejected) revert ExpenseNotPending(expenseId);
    }
}
