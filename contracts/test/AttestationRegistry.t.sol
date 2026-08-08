// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";

contract AttestationRegistryTest is Test {
    AttestationRegistry internal registry;

    address internal owner = makeAddr("owner");
    address internal vaultIssuer = makeAddr("vaultIssuer");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal mallory = makeAddr("mallory");

    uint256 internal constant WORKSPACE_ID = 1;
    string internal constant TASK_HASH = "task:design-system-v2";
    string internal constant METADATA_URI = "ipfs://QmAttestationMetadata";

    function setUp() public {
        vm.prank(owner);
        registry = new AttestationRegistry("Co-Op Attestations", "COOPA");

        vm.prank(owner);
        registry.setAuthorizedIssuer(vaultIssuer, true);
    }

    function _mint(address issuer, address contributor, string memory taskHash) internal returns (uint256 tokenId) {
        vm.prank(issuer);
        tokenId = registry.mintAttestation(contributor, WORKSPACE_ID, taskHash, METADATA_URI);
    }

    /*//////////////////////////////////////////////////////////////
                               DEPLOYMENT
    //////////////////////////////////////////////////////////////*/

    function test_Constructor_SetsMetadataAndOwner() public view {
        assertEq(registry.name(), "Co-Op Attestations");
        assertEq(registry.symbol(), "COOPA");
        assertEq(registry.owner(), owner);
        assertEq(registry.totalMinted(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                              AUTHORIZATION
    //////////////////////////////////////////////////////////////*/

    function test_SetAuthorizedIssuer_GrantsAndRevokes() public {
        assertTrue(registry.authorizedIssuers(vaultIssuer));

        vm.expectEmit(true, false, false, true, address(registry));
        emit AttestationRegistry.IssuerAuthorizationChanged(vaultIssuer, false);

        vm.prank(owner);
        registry.setAuthorizedIssuer(vaultIssuer, false);
        assertFalse(registry.authorizedIssuers(vaultIssuer));

        vm.prank(vaultIssuer);
        vm.expectRevert(abi.encodeWithSelector(AttestationRegistry.NotAuthorizedIssuer.selector, vaultIssuer));
        registry.mintAttestation(alice, WORKSPACE_ID, TASK_HASH, METADATA_URI);
    }

    function test_SetAuthorizedIssuer_RevertsForNonOwner() public {
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory));
        registry.setAuthorizedIssuer(mallory, true);
    }

    /*//////////////////////////////////////////////////////////////
                                MINTING
    //////////////////////////////////////////////////////////////*/

    function test_MintAttestation_ByAuthorizedIssuer() public {
        vm.expectEmit(true, true, true, true, address(registry));
        emit AttestationRegistry.AttestationMinted(1, WORKSPACE_ID, alice, vaultIssuer, TASK_HASH, METADATA_URI);

        uint256 tokenId = _mint(vaultIssuer, alice, TASK_HASH);

        AttestationRegistry.Attestation memory attestation = registry.getAttestation(tokenId);
        assertEq(tokenId, 1);
        assertEq(attestation.tokenId, 1);
        assertEq(attestation.workspaceId, WORKSPACE_ID);
        assertEq(attestation.contributor, alice);
        assertEq(attestation.issuer, vaultIssuer);
        assertEq(attestation.taskHash, TASK_HASH);
        assertEq(attestation.metadataURI, METADATA_URI);
        assertEq(attestation.issuedAt, uint64(block.timestamp));

        assertEq(registry.ownerOf(tokenId), alice);
        assertEq(registry.balanceOf(alice), 1);
        assertEq(registry.totalMinted(), 1);
        assertEq(registry.tokenURI(tokenId), METADATA_URI);
        assertTrue(registry.hasAttestation(WORKSPACE_ID, alice, TASK_HASH));
    }

    function test_MintAttestation_ByOwner() public {
        uint256 tokenId = _mint(owner, bob, TASK_HASH);
        assertEq(registry.ownerOf(tokenId), bob);
    }

    function test_MintAttestation_RevertsForUnauthorizedCaller() public {
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(AttestationRegistry.NotAuthorizedIssuer.selector, mallory));
        registry.mintAttestation(alice, WORKSPACE_ID, TASK_HASH, METADATA_URI);
    }

    function test_MintAttestation_RevertsOnDuplicateTask() public {
        _mint(vaultIssuer, alice, TASK_HASH);

        vm.prank(vaultIssuer);
        vm.expectRevert(
            abi.encodeWithSelector(
                AttestationRegistry.AttestationAlreadyMinted.selector, WORKSPACE_ID, alice, TASK_HASH
            )
        );
        registry.mintAttestation(alice, WORKSPACE_ID, TASK_HASH, METADATA_URI);
    }

    function test_MintAttestation_AllowsSameTaskForDifferentContributors() public {
        uint256 first = _mint(vaultIssuer, alice, TASK_HASH);
        uint256 second = _mint(vaultIssuer, bob, TASK_HASH);

        assertEq(first, 1);
        assertEq(second, 2);
        assertEq(registry.ownerOf(second), bob);
    }

    function test_MintAttestation_RevertsOnZeroContributor() public {
        vm.prank(vaultIssuer);
        vm.expectRevert(AttestationRegistry.InvalidContributor.selector);
        registry.mintAttestation(address(0), WORKSPACE_ID, TASK_HASH, METADATA_URI);
    }

    function test_MintAttestation_RevertsOnZeroWorkspace() public {
        vm.prank(vaultIssuer);
        vm.expectRevert(AttestationRegistry.InvalidWorkspace.selector);
        registry.mintAttestation(alice, 0, TASK_HASH, METADATA_URI);
    }

    function test_MintAttestation_RevertsOnEmptyTaskHash() public {
        vm.prank(vaultIssuer);
        vm.expectRevert(AttestationRegistry.EmptyTaskHash.selector);
        registry.mintAttestation(alice, WORKSPACE_ID, "", METADATA_URI);
    }

    function test_MintAttestation_IndexesByContributorAndWorkspace() public {
        _mint(vaultIssuer, alice, "task:a");
        _mint(vaultIssuer, alice, "task:b");
        _mint(vaultIssuer, bob, "task:c");

        uint256[] memory aliceTokens = registry.tokensOfContributor(alice);
        assertEq(aliceTokens.length, 2);
        assertEq(aliceTokens[0], 1);
        assertEq(aliceTokens[1], 2);

        assertEq(registry.tokensOfContributor(bob).length, 1);
        assertEq(registry.tokensOfWorkspace(WORKSPACE_ID).length, 3);
    }

    function test_GetAttestation_RevertsForUnknownToken() public {
        vm.expectRevert(abi.encodeWithSelector(AttestationRegistry.AttestationNotFound.selector, 5));
        registry.getAttestation(5);
    }

    /*//////////////////////////////////////////////////////////////
                          SOULBOUND ENFORCEMENT
    //////////////////////////////////////////////////////////////*/

    function test_Transfer_RevertsForHolder() public {
        uint256 tokenId = _mint(vaultIssuer, alice, TASK_HASH);

        vm.prank(alice);
        vm.expectRevert(AttestationRegistry.NonTransferable.selector);
        registry.transferFrom(alice, bob, tokenId);
    }

    function test_SafeTransfer_RevertsForHolder() public {
        uint256 tokenId = _mint(vaultIssuer, alice, TASK_HASH);

        vm.prank(alice);
        vm.expectRevert(AttestationRegistry.NonTransferable.selector);
        registry.safeTransferFrom(alice, bob, tokenId);
    }

    function test_Approve_Reverts() public {
        uint256 tokenId = _mint(vaultIssuer, alice, TASK_HASH);

        vm.prank(alice);
        vm.expectRevert(AttestationRegistry.NonTransferable.selector);
        registry.approve(bob, tokenId);
    }

    function test_SetApprovalForAll_Reverts() public {
        _mint(vaultIssuer, alice, TASK_HASH);

        vm.prank(alice);
        vm.expectRevert(AttestationRegistry.NonTransferable.selector);
        registry.setApprovalForAll(bob, true);
    }

    /*//////////////////////////////////////////////////////////////
                               REVOCATION
    //////////////////////////////////////////////////////////////*/

    function test_RevokeAttestation_ByIssuerBurnsToken() public {
        uint256 tokenId = _mint(vaultIssuer, alice, TASK_HASH);

        vm.expectEmit(true, true, false, true, address(registry));
        emit AttestationRegistry.AttestationRevoked(tokenId, vaultIssuer);

        vm.prank(vaultIssuer);
        registry.revokeAttestation(tokenId);

        assertEq(registry.balanceOf(alice), 0);
        assertFalse(registry.hasAttestation(WORKSPACE_ID, alice, TASK_HASH));

        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, tokenId));
        registry.ownerOf(tokenId);
    }

    function test_RevokeAttestation_ByOwner() public {
        uint256 tokenId = _mint(vaultIssuer, alice, TASK_HASH);

        vm.prank(owner);
        registry.revokeAttestation(tokenId);

        assertEq(registry.balanceOf(alice), 0);
    }

    function test_RevokeAttestation_RevertsForUnrelatedCaller() public {
        uint256 tokenId = _mint(vaultIssuer, alice, TASK_HASH);

        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(AttestationRegistry.NotAuthorizedIssuer.selector, mallory));
        registry.revokeAttestation(tokenId);
    }

    function test_RevokeAttestation_AllowsReissuingCorrectedAttestation() public {
        uint256 tokenId = _mint(vaultIssuer, alice, TASK_HASH);

        vm.prank(vaultIssuer);
        registry.revokeAttestation(tokenId);

        uint256 reissued = _mint(vaultIssuer, alice, TASK_HASH);
        assertEq(reissued, 2, "token ids are never reused");
        assertEq(registry.ownerOf(reissued), alice);
        assertTrue(registry.hasAttestation(WORKSPACE_ID, alice, TASK_HASH));
    }

    /*//////////////////////////////////////////////////////////////
                                  FUZZ
    //////////////////////////////////////////////////////////////*/

    function testFuzz_MintAttestation_AssignsSequentialIds(uint8 count) public {
        count = uint8(bound(count, 1, 20));

        for (uint256 i = 0; i < count; ++i) {
            uint256 tokenId = _mint(vaultIssuer, alice, vm.toString(i));
            assertEq(tokenId, i + 1);
        }

        assertEq(registry.totalMinted(), count);
        assertEq(registry.balanceOf(alice), count);
    }
}
