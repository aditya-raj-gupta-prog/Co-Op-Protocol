// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {CoOpVault} from "../src/CoOpVault.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";

contract SeedDemo is Script {
    CoOpVault public vault;
    AttestationRegistry public registry;

    address constant VAULT_ADDR = 0x5fbdB2315678afcCB33f46c0c4A8f22b1E6BD5Ef;
    address constant REGISTRY_ADDR = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vault = CoOpVault(VAULT_ADDR);
        registry = AttestationRegistry(REGISTRY_ADDR);

        vm.startBroadcast(deployerKey);

        // Create workspace: "IITR Hackathon Team Vault" with 2/3 threshold
        address[] memory members = new address[](2);
        members[0] = makeAddr("alice");
        members[1] = makeAddr("bob");

        uint256 workspaceId = vault.createWorkspace("IITR Hackathon Team Vault", members, 2);
        console.log("Created workspace ID:", workspaceId);

        // Deposit 0.5 ETH
        vault.deposit{value: 0.5 ether}(workspaceId);
        console.log("Deposited 0.5 ETH");

        // Expense 1: "Graphics & UI Design Assets" - 0.05 ETH, 1/2 approvals
        uint256 expense1 = vault.createExpense(
            workspaceId, payable(makeAddr("vendor1")), 0.05 ether, "ipfs://design-assets-hash"
        );
        vm.prank(members[0]);
        vault.approveExpense(expense1);
        console.log("Created expense 1 (Graphics & UI Design):", expense1);

        // Expense 2: "IPFS Node Hosting Fee" - 0.02 ETH, 2/2 approvals
        uint256 expense2 = vault.createExpense(
            workspaceId, payable(makeAddr("vendor2")), 0.02 ether, "ipfs://hosting-receipt"
        );
        vm.prank(members[0]);
        vault.approveExpense(expense2);
        vm.prank(members[1]);
        vault.approveExpense(expense2);
        console.log("Created expense 2 (IPFS Hosting):", expense2);

        // Mint attestation: "Smart Contract Architecture Completion"
        uint256 tokenId = registry.mintAttestation(
            deployer, workspaceId, "task:smart-contract-architecture", "ipfs://attestation-metadata"
        );
        console.log("Minted attestation token:", tokenId);

        vm.stopBroadcast();

        console.log("=== SEED DATA COMPLETE ===");
        console.log("Workspace members[0] (alice):", members[0]);
        console.log("Workspace members[1] (bob):", members[1]);
    }
}
