const { ethers, network } = require("hardhat");

import { abi } from "../artifacts/contracts/ERC20.sol/ERC20.json";
import config from "../constants/config";

import deploy from "./../deploy/artifacts/deploy.json";

async function main() {
  console.info("Enrollment started ...");
  // setting remote for current network, we can create task for it
  const erc20TokenAddress = deploy[network.name];
  const [signer] = await ethers.getSigners();
  const erc20Contract = await ethers.getContractAt(
    abi,
    erc20TokenAddress,
    signer
  );

  // hard coded for polygonmumbai and bsctestnet here
  let remoteChain;
  if (network.name == "polygonmumbai") remoteChain = "goerli";
  else remoteChain = "polygonmumbai";

  const remoteChainId = config[remoteChain].chainId;
  const remoteChainType = config[remoteChain].chainType;
  const remoteChainContractAddress = deploy[remoteChain];

  const tx = await erc20Contract.setContractOnChain(
    remoteChainType,
    remoteChainId,
    remoteChainContractAddress
  );

  console.log("trusted remote: tx sent with tx hash ", tx.hash);
  await tx.wait();
  console.log("Added remote to  ", network.name, " to ", remoteChain);
}

main()
  .then(() => console.info("Enrollmented completed !!"))
  .catch(console.error);
