// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AttestationRegistry
/// @notice Soulbound (non-transferable) ERC-721 attestations recording verified contributions.
/// @dev Tokens can be minted and burned but never moved between accounts, so an attestation
///      always points at the address that actually earned it.
contract AttestationRegistry is ERC721, Ownable {
    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    struct Attestation {
        uint256 tokenId;
        uint256 workspaceId;
        address contributor;
        address issuer;
        string taskHash;
        string metadataURI;
        uint64 issuedAt;
    }

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotAuthorizedIssuer(address account);
    error InvalidContributor();
    error InvalidWorkspace();
    error EmptyTaskHash();
    error AttestationAlreadyMinted(uint256 workspaceId, address contributor, string taskHash);
    error AttestationNotFound(uint256 tokenId);
    error NonTransferable();

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event IssuerAuthorizationChanged(address indexed issuer, bool authorized);
    event AttestationMinted(
        uint256 indexed tokenId,
        uint256 indexed workspaceId,
        address indexed contributor,
        address issuer,
        string taskHash,
        string metadataURI
    );
    event AttestationRevoked(uint256 indexed tokenId, address indexed revokedBy);

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Number of attestations ever minted; token ids are 1-indexed and never reused.
    uint256 public totalMinted;

    /// @notice Addresses (typically `CoOpVault` deployments) allowed to mint attestations.
    mapping(address issuer => bool authorized) public authorizedIssuers;

    mapping(uint256 tokenId => Attestation) private _attestations;
    /// @dev keccak256(workspaceId, contributor, taskHash) => already minted, to block duplicates.
    mapping(bytes32 attestationKey => bool minted) private _minted;
    mapping(address contributor => uint256[] tokenIds) private _tokensOfContributor;
    mapping(uint256 workspaceId => uint256[] tokenIds) private _tokensOfWorkspace;

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) Ownable(msg.sender) {}

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyAuthorized() {
        if (msg.sender != owner() && !authorizedIssuers[msg.sender]) revert NotAuthorizedIssuer(msg.sender);
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              AUTHORIZATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Grants or revokes minting rights for a workspace vault or trusted issuer.
    function setAuthorizedIssuer(address issuer, bool authorized) external onlyOwner {
        if (issuer == address(0)) revert NotAuthorizedIssuer(issuer);
        authorizedIssuers[issuer] = authorized;
        emit IssuerAuthorizationChanged(issuer, authorized);
    }

    /*//////////////////////////////////////////////////////////////
                               ATTESTATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Mints a soulbound attestation for a contributor's completed task.
    /// @param contributor Account that performed the work and receives the token.
    /// @param workspaceId Workspace the contribution belongs to.
    /// @param taskHash Stable identifier of the task (hash, issue id, commit).
    /// @param metadataURI IPFS CID or URI with the attestation payload; returned by `tokenURI`.
    /// @return tokenId Id of the newly minted attestation.
    function mintAttestation(
        address contributor,
        uint256 workspaceId,
        string memory taskHash,
        string memory metadataURI
    ) external onlyAuthorized returns (uint256 tokenId) {
        if (contributor == address(0)) revert InvalidContributor();
        if (workspaceId == 0) revert InvalidWorkspace();
        if (bytes(taskHash).length == 0) revert EmptyTaskHash();

        bytes32 key = _attestationKey(workspaceId, contributor, taskHash);
        if (_minted[key]) revert AttestationAlreadyMinted(workspaceId, contributor, taskHash);
        _minted[key] = true;

        tokenId = ++totalMinted;

        _attestations[tokenId] = Attestation({
            tokenId: tokenId,
            workspaceId: workspaceId,
            contributor: contributor,
            issuer: msg.sender,
            taskHash: taskHash,
            metadataURI: metadataURI,
            issuedAt: uint64(block.timestamp)
        });
        _tokensOfContributor[contributor].push(tokenId);
        _tokensOfWorkspace[workspaceId].push(tokenId);

        _safeMint(contributor, tokenId);

        emit AttestationMinted(tokenId, workspaceId, contributor, msg.sender, taskHash, metadataURI);
    }

    /// @notice Burns a mistaken attestation. Callable by the original issuer or the owner.
    /// @dev Frees the duplicate-protection key so a corrected attestation can be re-issued.
    function revokeAttestation(uint256 tokenId) external {
        Attestation storage attestation = _requireAttestation(tokenId);
        if (msg.sender != owner() && msg.sender != attestation.issuer) revert NotAuthorizedIssuer(msg.sender);

        _minted[_attestationKey(attestation.workspaceId, attestation.contributor, attestation.taskHash)] = false;

        _burn(tokenId);
        emit AttestationRevoked(tokenId, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    function getAttestation(uint256 tokenId) external view returns (Attestation memory) {
        return _requireAttestation(tokenId);
    }

    /// @notice All attestation ids ever minted for a contributor, including revoked ones.
    function tokensOfContributor(address contributor) external view returns (uint256[] memory) {
        return _tokensOfContributor[contributor];
    }

    /// @notice All attestation ids ever minted under a workspace, including revoked ones.
    function tokensOfWorkspace(uint256 workspaceId) external view returns (uint256[] memory) {
        return _tokensOfWorkspace[workspaceId];
    }

    /// @notice True when this exact (workspace, contributor, task) attestation is currently live.
    function hasAttestation(uint256 workspaceId, address contributor, string memory taskHash)
        external
        view
        returns (bool)
    {
        return _minted[_attestationKey(workspaceId, contributor, taskHash)];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _attestations[tokenId].metadataURI;
    }

    /*//////////////////////////////////////////////////////////////
                            SOULBOUND ENFORCEMENT
    //////////////////////////////////////////////////////////////*/

    /// @dev Permits mints (`from == 0`) and burns (`to == 0`) but rejects every transfer.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert NonTransferable();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert NonTransferable();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert NonTransferable();
    }

    /*//////////////////////////////////////////////////////////////
                                INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _attestationKey(uint256 workspaceId, address contributor, string memory taskHash)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(workspaceId, contributor, taskHash));
    }

    function _requireAttestation(uint256 tokenId) private view returns (Attestation storage attestation) {
        if (tokenId == 0 || tokenId > totalMinted) revert AttestationNotFound(tokenId);
        attestation = _attestations[tokenId];
    }
}
