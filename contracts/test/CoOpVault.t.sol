// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {CoOpVault} from "../src/CoOpVault.sol";

/// @dev Recipient that always rejects incoming native currency.
contract RejectingRecipient {
    receive() external payable {
        revert("no thanks");
    }
}

/// @dev Recipient that accepts native currency without any logic.
contract AcceptingRecipient {
    receive() external payable {}
}

/// @dev Recipient that tries to re-enter the vault while being paid.
contract ReentrantRecipient {
    CoOpVault public immutable VAULT;
    uint256 public expenseId;

    constructor(CoOpVault vault_) {
        VAULT = vault_;
    }

    function setExpenseId(uint256 expenseId_) external {
        expenseId = expenseId_;
    }

    receive() external payable {
        VAULT.executeExpense(expenseId);
    }
}

contract CoOpVaultTest is Test {
    CoOpVault internal vault;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal mallory = makeAddr("mallory");
    address payable internal vendor = payable(makeAddr("vendor"));

    string internal constant WORKSPACE_NAME = "Design Guild";
    string internal constant METADATA = "ipfs://QmReceiptHash";

    function setUp() public {
        vm.prank(owner);
        vault = new CoOpVault();

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
        vm.deal(mallory, 100 ether);
    }

    /*//////////////////////////////////////////////////////////////
                                HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @dev Workspace with alice (creator), bob and carol as members.
    function _createWorkspace(uint256 threshold) internal returns (uint256 workspaceId) {
        address[] memory initialMembers = new address[](2);
        initialMembers[0] = bob;
        initialMembers[1] = carol;

        vm.prank(alice);
        workspaceId = vault.createWorkspace(WORKSPACE_NAME, initialMembers, threshold);
    }

    function _fundedWorkspace(uint256 threshold, uint256 amount) internal returns (uint256 workspaceId) {
        workspaceId = _createWorkspace(threshold);
        vm.prank(alice);
        vault.deposit{value: amount}(workspaceId);
    }

    /*//////////////////////////////////////////////////////////////
                          WORKSPACE CREATION
    //////////////////////////////////////////////////////////////*/

    function test_CreateWorkspace_StoresWorkspaceState() public {
        uint256 workspaceId = _createWorkspace(2);

        CoOpVault.Workspace memory ws = vault.getWorkspace(workspaceId);
        assertEq(workspaceId, 1, "ids are 1-indexed");
        assertEq(ws.id, 1);
        assertEq(ws.name, WORKSPACE_NAME);
        assertEq(ws.approvalThreshold, 2);
        assertEq(ws.memberCount, 3);
        assertTrue(ws.active);
        assertEq(vault.workspaceCount(), 1);
    }

    function test_CreateWorkspace_RegistersCreatorAndInitialMembers() public {
        uint256 workspaceId = _createWorkspace(2);

        assertTrue(vault.isMember(workspaceId, alice), "creator is a member");
        assertTrue(vault.isMember(workspaceId, bob));
        assertTrue(vault.isMember(workspaceId, carol));
        assertFalse(vault.isMember(workspaceId, mallory));

        address[] memory members = vault.getMembers(workspaceId);
        assertEq(members.length, 3);
        assertEq(members[0], alice);
        assertEq(members[1], bob);
        assertEq(members[2], carol);
    }

    function test_CreateWorkspace_DeduplicatesCreatorListedAsMember() public {
        address[] memory initialMembers = new address[](3);
        initialMembers[0] = alice; // creator listed again
        initialMembers[1] = bob;
        initialMembers[2] = bob; // duplicate

        vm.prank(alice);
        uint256 workspaceId = vault.createWorkspace(WORKSPACE_NAME, initialMembers, 2);

        assertEq(vault.getWorkspace(workspaceId).memberCount, 2, "alice and bob only");
        assertEq(vault.getMembers(workspaceId).length, 2);
    }

    function test_CreateWorkspace_EmitsEvent() public {
        address[] memory initialMembers = new address[](2);
        initialMembers[0] = bob;
        initialMembers[1] = carol;

        vm.expectEmit(true, true, false, true, address(vault));
        emit CoOpVault.WorkspaceCreated(1, alice, WORKSPACE_NAME, 2, 3);

        vm.prank(alice);
        vault.createWorkspace(WORKSPACE_NAME, initialMembers, 2);
    }

    function test_CreateWorkspace_IncrementsIds() public {
        assertEq(_createWorkspace(1), 1);
        assertEq(_createWorkspace(1), 2);
        assertEq(vault.workspaceCount(), 2);
    }

    function test_CreateWorkspace_AcceptsThresholdOfOne() public {
        uint256 workspaceId = _createWorkspace(1);
        assertEq(vault.getWorkspace(workspaceId).approvalThreshold, 1);
    }

    function test_CreateWorkspace_AcceptsUnanimousThreshold() public {
        uint256 workspaceId = _createWorkspace(3);
        assertEq(vault.getWorkspace(workspaceId).approvalThreshold, 3);
    }

    function test_CreateWorkspace_RevertsOnZeroThreshold() public {
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.InvalidThreshold.selector, 0, 3));
        _createWorkspace(0);
    }

    function test_CreateWorkspace_RevertsWhenThresholdExceedsMemberCount() public {
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.InvalidThreshold.selector, 4, 3));
        _createWorkspace(4);
    }

    function test_CreateWorkspace_RevertsOnEmptyName() public {
        address[] memory initialMembers = new address[](0);

        vm.prank(alice);
        vm.expectRevert(CoOpVault.EmptyName.selector);
        vault.createWorkspace("", initialMembers, 1);
    }

    function test_CreateWorkspace_RevertsOnZeroAddressMember() public {
        address[] memory initialMembers = new address[](1);
        initialMembers[0] = address(0);

        vm.prank(alice);
        vm.expectRevert(CoOpVault.ZeroAddressMember.selector);
        vault.createWorkspace(WORKSPACE_NAME, initialMembers, 1);
    }

    function test_GetWorkspace_RevertsForUnknownId() public {
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.WorkspaceNotFound.selector, 99));
        vault.getWorkspace(99);
    }

    /*//////////////////////////////////////////////////////////////
                                DEPOSITS
    //////////////////////////////////////////////////////////////*/

    function test_Deposit_CreditsTreasury() public {
        uint256 workspaceId = _createWorkspace(2);

        vm.prank(alice);
        vault.deposit{value: 5 ether}(workspaceId);

        assertEq(vault.treasuryOf(workspaceId), 5 ether);
        assertEq(address(vault).balance, 5 ether);
        assertEq(alice.balance, 95 ether);
    }

    function test_Deposit_AcceptsFundsFromNonMembers() public {
        uint256 workspaceId = _createWorkspace(2);

        vm.prank(mallory);
        vault.deposit{value: 1 ether}(workspaceId);

        assertEq(vault.treasuryOf(workspaceId), 1 ether, "deposits are permissionless");
    }

    function test_Deposit_Accumulates() public {
        uint256 workspaceId = _createWorkspace(2);

        vm.prank(alice);
        vault.deposit{value: 1 ether}(workspaceId);
        vm.prank(bob);
        vault.deposit{value: 2.5 ether}(workspaceId);

        assertEq(vault.treasuryOf(workspaceId), 3.5 ether);
    }

    function test_Deposit_EmitsEvent() public {
        uint256 workspaceId = _createWorkspace(2);

        vm.expectEmit(true, true, false, true, address(vault));
        emit CoOpVault.Deposited(workspaceId, alice, 2 ether, 2 ether);

        vm.prank(alice);
        vault.deposit{value: 2 ether}(workspaceId);
    }

    function test_Deposit_KeepsTreasuriesIsolated() public {
        uint256 first = _createWorkspace(2);
        uint256 second = _createWorkspace(2);

        vm.prank(alice);
        vault.deposit{value: 4 ether}(first);
        vm.prank(bob);
        vault.deposit{value: 1 ether}(second);

        assertEq(vault.treasuryOf(first), 4 ether);
        assertEq(vault.treasuryOf(second), 1 ether);
        assertEq(address(vault).balance, 5 ether, "vault balance equals the sum of treasuries");
    }

    function test_Deposit_RevertsOnZeroValue() public {
        uint256 workspaceId = _createWorkspace(2);

        vm.prank(alice);
        vm.expectRevert(CoOpVault.ZeroDeposit.selector);
        vault.deposit{value: 0}(workspaceId);
    }

    function test_Deposit_RevertsForUnknownWorkspace() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.WorkspaceNotFound.selector, 42));
        vault.deposit{value: 1 ether}(42);
    }

    function test_Deposit_RevertsForInactiveWorkspace() public {
        uint256 workspaceId = _createWorkspace(2);

        vm.prank(owner);
        vault.setWorkspaceActive(workspaceId, false);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.WorkspaceInactive.selector, workspaceId));
        vault.deposit{value: 1 ether}(workspaceId);
    }

    function test_Vault_RejectsDirectTransfers() public {
        vm.prank(alice);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertFalse(ok, "no receive/fallback keeps balance and accounting in sync");
    }

    /*//////////////////////////////////////////////////////////////
                           EXPENSE PROPOSALS
    //////////////////////////////////////////////////////////////*/

    function test_CreateExpense_ByMemberStoresRequest() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);

        vm.prank(bob);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 3 ether, METADATA);

        CoOpVault.ExpenseRequest memory expense = vault.getExpense(expenseId);
        assertEq(expenseId, 1);
        assertEq(expense.id, 1);
        assertEq(expense.workspaceId, workspaceId);
        assertEq(expense.recipient, vendor);
        assertEq(expense.amount, 3 ether);
        assertEq(expense.metadataHash, METADATA);
        assertEq(expense.approvalsCount, 0);
        assertFalse(expense.executed);
        assertFalse(expense.rejected);
        assertEq(vault.proposerOf(expenseId), bob);
        assertEq(vault.expenseCount(), 1);
        assertTrue(vault.isExpensePending(expenseId));
    }

    function test_CreateExpense_EmitsEvent() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);

        vm.expectEmit(true, true, true, true, address(vault));
        emit CoOpVault.ExpenseCreated(1, workspaceId, vendor, alice, 3 ether, METADATA);

        vm.prank(alice);
        vault.createExpense(workspaceId, vendor, 3 ether, METADATA);
    }

    function test_CreateExpense_RevertsForNonMember() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);

        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.NotWorkspaceMember.selector, workspaceId, mallory));
        vault.createExpense(workspaceId, vendor, 1 ether, METADATA);
    }

    function test_CreateExpense_RevertsForMemberOfAnotherWorkspace() public {
        uint256 first = _fundedWorkspace(2, 10 ether);

        address[] memory outsiders = new address[](0);
        vm.prank(mallory);
        vault.createWorkspace("Other Guild", outsiders, 1);

        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.NotWorkspaceMember.selector, first, mallory));
        vault.createExpense(first, vendor, 1 ether, METADATA);
    }

    function test_CreateExpense_RevertsOnZeroAmount() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);

        vm.prank(alice);
        vm.expectRevert(CoOpVault.ZeroAmount.selector);
        vault.createExpense(workspaceId, vendor, 0, METADATA);
    }

    function test_CreateExpense_RevertsOnZeroRecipient() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);

        vm.prank(alice);
        vm.expectRevert(CoOpVault.InvalidRecipient.selector);
        vault.createExpense(workspaceId, payable(address(0)), 1 ether, METADATA);
    }

    function test_CreateExpense_RevertsForInactiveWorkspace() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);

        vm.prank(owner);
        vault.setWorkspaceActive(workspaceId, false);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.WorkspaceInactive.selector, workspaceId));
        vault.createExpense(workspaceId, vendor, 1 ether, METADATA);
    }

    function test_GetExpense_RevertsForUnknownId() public {
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.ExpenseNotFound.selector, 7));
        vault.getExpense(7);
    }

    /*//////////////////////////////////////////////////////////////
                          APPROVALS & EXECUTION
    //////////////////////////////////////////////////////////////*/

    function test_ApproveExpense_RecordsVoteBelowThreshold() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);
        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 3 ether, METADATA);

        vm.prank(alice);
        vault.approveExpense(expenseId);

        CoOpVault.ExpenseRequest memory expense = vault.getExpense(expenseId);
        assertEq(expense.approvalsCount, 1);
        assertFalse(expense.executed, "one approval is short of the threshold");
        assertTrue(vault.hasApproved(expenseId, alice));
        assertEq(vendor.balance, 0);
        assertEq(vault.treasuryOf(workspaceId), 10 ether);
    }

    function test_ApproveExpense_EmitsEvent() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);
        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 3 ether, METADATA);

        vm.expectEmit(true, true, false, true, address(vault));
        emit CoOpVault.ExpenseApproved(expenseId, alice, 1);

        vm.prank(alice);
        vault.approveExpense(expenseId);
    }

    function test_ApproveExpense_AutoExecutesAtThreshold() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);
        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 3 ether, METADATA);

        vm.prank(alice);
        vault.approveExpense(expenseId);

        vm.expectEmit(true, true, false, true, address(vault));
        emit CoOpVault.ExpenseExecuted(expenseId, vendor, 3 ether);

        vm.prank(bob);
        vault.approveExpense(expenseId);

        CoOpVault.ExpenseRequest memory expense = vault.getExpense(expenseId);
        assertEq(expense.approvalsCount, 2);
        assertTrue(expense.executed, "payout fires as soon as the threshold is met");
        assertEq(vendor.balance, 3 ether);
        assertEq(vault.treasuryOf(workspaceId), 7 ether);
        assertEq(address(vault).balance, 7 ether);
        assertFalse(vault.isExpensePending(expenseId));
    }

    function test_ApproveExpense_ThresholdOfOnePaysOutImmediately() public {
        uint256 workspaceId = _fundedWorkspace(1, 10 ether);
        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 2 ether, METADATA);

        vm.prank(alice);
        vault.approveExpense(expenseId);

        assertTrue(vault.getExpense(expenseId).executed);
        assertEq(vendor.balance, 2 ether);
    }

    function test_ApproveExpense_UnanimousThresholdRequiresEveryMember() public {
        uint256 workspaceId = _fundedWorkspace(3, 10 ether);
        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 1 ether, METADATA);

        vm.prank(alice);
        vault.approveExpense(expenseId);
        vm.prank(bob);
        vault.approveExpense(expenseId);
        assertFalse(vault.getExpense(expenseId).executed, "two of three is not enough");

        vm.prank(carol);
        vault.approveExpense(expenseId);
        assertTrue(vault.getExpense(expenseId).executed);
        assertEq(vendor.balance, 1 ether);
    }

    function test_ApproveExpense_RevertsOnDuplicateVote() public {
        uint256 workspaceId = _fundedWorkspace(3, 10 ether);
        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 1 ether, METADATA);

        vm.prank(alice);
        vault.approveExpense(expenseId);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.AlreadyApproved.selector, expenseId, alice));
        vault.approveExpense(expenseId);

        assertEq(vault.getExpense(expenseId).approvalsCount, 1, "double voting cannot inflate the tally");
    }

    function test_ApproveExpense_RevertsForNonMember() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);
        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 1 ether, METADATA);

        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.NotWorkspaceMember.selector, workspaceId, mallory));
        vault.approveExpense(expenseId);
    }

    function test_ApproveExpense_RevertsOnceExecuted() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);
        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 1 ether, METADATA);

        vm.prank(alice);
        vault.approveExpense(expenseId);
        vm.prank(bob);
        vault.approveExpense(expenseId);

        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.ExpenseNotPending.selector, expenseId));
        vault.approveExpense(expenseId);
    }

    function test_ApproveExpense_RevertsForUnknownExpense() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.ExpenseNotFound.selector, 1));
        vault.approveExpense(1);
    }

    function test_ApproveExpense_StaysPendingWhenTreasuryIsShort() public {
        uint256 workspaceId = _createWorkspace(2); // unfunded
        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 5 ether, METADATA);

        vm.prank(alice);
        vault.approveExpense(expenseId);
        vm.prank(bob);
        vault.approveExpense(expenseId);

        CoOpVault.ExpenseRequest memory expense = vault.getExpense(expenseId);
        assertEq(expense.approvalsCount, 2, "votes are recorded even when funds are missing");
        assertFalse(expense.executed);
        assertTrue(vault.isExpensePending(expenseId));

        // Funding later lets anyone settle the already-approved request.
        vm.prank(mallory);
        vault.deposit{value: 5 ether}(workspaceId);
        vault.executeExpense(expenseId);

        assertTrue(vault.getExpense(expenseId).executed);
        assertEq(vendor.balance, 5 ether);
        assertEq(vault.treasuryOf(workspaceId), 0);
    }

    function test_ExecuteExpense_RevertsBelowThreshold() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);
        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 1 ether, METADATA);

        vm.prank(alice);
        vault.approveExpense(expenseId);

        vm.expectRevert(abi.encodeWithSelector(CoOpVault.ThresholdNotMet.selector, 1, 2));
        vault.executeExpense(expenseId);
    }

    function test_ExecuteExpense_RevertsOnInsufficientTreasury() public {
        uint256 workspaceId = _fundedWorkspace(2, 1 ether);
        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 5 ether, METADATA);

        vm.prank(alice);
        vault.approveExpense(expenseId);
        vm.prank(bob);
        vault.approveExpense(expenseId);

        vm.expectRevert(abi.encodeWithSelector(CoOpVault.InsufficientTreasury.selector, 1 ether, 5 ether));
        vault.executeExpense(expenseId);
    }

    function test_ExecuteExpense_RevertsWhenAlreadyExecuted() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);
        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 1 ether, METADATA);

        vm.prank(alice);
        vault.approveExpense(expenseId);
        vm.prank(bob);
        vault.approveExpense(expenseId);

        vm.expectRevert(abi.encodeWithSelector(CoOpVault.ExpenseNotPending.selector, expenseId));
        vault.executeExpense(expenseId);
    }

    function test_ExecuteExpense_PaysContractRecipients() public {
        AcceptingRecipient recipient = new AcceptingRecipient();
        uint256 workspaceId = _fundedWorkspace(1, 10 ether);

        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, payable(address(recipient)), 4 ether, METADATA);
        vm.prank(alice);
        vault.approveExpense(expenseId);

        assertEq(address(recipient).balance, 4 ether);
    }

    function test_ExecuteExpense_RevertsWhenRecipientRejectsFunds() public {
        RejectingRecipient recipient = new RejectingRecipient();
        uint256 workspaceId = _fundedWorkspace(1, 10 ether);

        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, payable(address(recipient)), 4 ether, METADATA);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CoOpVault.TransferFailed.selector, expenseId, address(recipient), 4 ether)
        );
        vault.approveExpense(expenseId);

        assertEq(vault.treasuryOf(workspaceId), 10 ether, "failed payout leaves the treasury untouched");
    }

    function test_ExecuteExpense_BlocksReentrantRecipient() public {
        ReentrantRecipient attacker = new ReentrantRecipient(vault);
        uint256 workspaceId = _fundedWorkspace(1, 10 ether);

        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, payable(address(attacker)), 4 ether, METADATA);
        attacker.setExpenseId(expenseId);

        // The re-entrant call trips the guard, so the payout call fails and the whole tx unwinds.
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CoOpVault.TransferFailed.selector, expenseId, address(attacker), 4 ether)
        );
        vault.approveExpense(expenseId);

        assertEq(vault.treasuryOf(workspaceId), 10 ether);
        assertEq(address(attacker).balance, 0);
    }

    /*//////////////////////////////////////////////////////////////
                               REJECTION
    //////////////////////////////////////////////////////////////*/

    function test_RejectExpense_ByProposer() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);
        vm.prank(bob);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 1 ether, METADATA);

        vm.expectEmit(true, true, false, true, address(vault));
        emit CoOpVault.ExpenseRejected(expenseId, bob);

        vm.prank(bob);
        vault.rejectExpense(expenseId);

        assertTrue(vault.getExpense(expenseId).rejected);
        assertFalse(vault.isExpensePending(expenseId));
    }

    function test_RejectExpense_ByContractOwner() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);
        vm.prank(bob);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 1 ether, METADATA);

        vm.prank(owner);
        vault.rejectExpense(expenseId);

        assertTrue(vault.getExpense(expenseId).rejected);
    }

    function test_RejectExpense_RevertsForUnrelatedMember() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);
        vm.prank(bob);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 1 ether, METADATA);

        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.NotAuthorized.selector, carol));
        vault.rejectExpense(expenseId);
    }

    function test_RejectExpense_BlocksFurtherApprovalAndExecution() public {
        uint256 workspaceId = _fundedWorkspace(2, 10 ether);
        vm.prank(bob);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, 1 ether, METADATA);

        vm.prank(bob);
        vault.approveExpense(expenseId);
        vm.prank(bob);
        vault.rejectExpense(expenseId);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.ExpenseNotPending.selector, expenseId));
        vault.approveExpense(expenseId);

        vm.expectRevert(abi.encodeWithSelector(CoOpVault.ExpenseNotPending.selector, expenseId));
        vault.executeExpense(expenseId);

        assertEq(vendor.balance, 0);
    }

    /*//////////////////////////////////////////////////////////////
                             ACCESS CONTROL
    //////////////////////////////////////////////////////////////*/

    function test_Constructor_SetsDeployerAsOwner() public view {
        assertEq(vault.owner(), owner);
    }

    function test_SetWorkspaceActive_TogglesStatus() public {
        uint256 workspaceId = _createWorkspace(2);

        vm.prank(owner);
        vault.setWorkspaceActive(workspaceId, false);
        assertFalse(vault.getWorkspace(workspaceId).active);

        vm.prank(owner);
        vault.setWorkspaceActive(workspaceId, true);
        assertTrue(vault.getWorkspace(workspaceId).active);
    }

    function test_SetWorkspaceActive_RevertsForNonOwner() public {
        uint256 workspaceId = _createWorkspace(2);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.setWorkspaceActive(workspaceId, false);
    }

    /*//////////////////////////////////////////////////////////////
                                  FUZZ
    //////////////////////////////////////////////////////////////*/

    function testFuzz_Deposit_CreditsAnyNonZeroAmount(uint96 amount) public {
        amount = uint96(bound(amount, 1, type(uint96).max));
        uint256 workspaceId = _createWorkspace(2);

        vm.deal(alice, amount);
        vm.prank(alice);
        vault.deposit{value: amount}(workspaceId);

        assertEq(vault.treasuryOf(workspaceId), amount);
        assertEq(address(vault).balance, amount);
    }

    function testFuzz_CreateWorkspace_AcceptsThresholdWithinMemberCount(uint256 threshold) public {
        threshold = bound(threshold, 1, 3);
        uint256 workspaceId = _createWorkspace(threshold);
        assertEq(vault.getWorkspace(workspaceId).approvalThreshold, threshold);
    }

    function testFuzz_CreateWorkspace_RejectsThresholdAboveMemberCount(uint256 threshold) public {
        threshold = bound(threshold, 4, type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(CoOpVault.InvalidThreshold.selector, threshold, 3));
        _createWorkspace(threshold);
    }

    function testFuzz_ExpenseLifecycle_ConservesVaultBalance(uint96 funding, uint96 spend) public {
        funding = uint96(bound(funding, 1, type(uint96).max));
        spend = uint96(bound(spend, 1, funding));

        uint256 workspaceId = _createWorkspace(2);
        vm.deal(alice, funding);
        vm.prank(alice);
        vault.deposit{value: funding}(workspaceId);

        vm.prank(alice);
        uint256 expenseId = vault.createExpense(workspaceId, vendor, spend, METADATA);
        vm.prank(alice);
        vault.approveExpense(expenseId);
        vm.prank(bob);
        vault.approveExpense(expenseId);

        assertEq(vendor.balance, spend);
        assertEq(vault.treasuryOf(workspaceId), uint256(funding) - spend);
        assertEq(address(vault).balance, vault.treasuryOf(workspaceId), "accounting matches the real balance");
    }
}
