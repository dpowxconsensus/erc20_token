import { task, types } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import deploy from "./../deploy/artifacts/deploy.json";
import config from "../constants/config";
import { abi } from "../artifacts/contracts/ERC20.sol/ERC20.json";

// mapping network contract to remote chain
task("ENROLLREMOTE_CONTRACT", "enroll remote contract on src chain")
  .addParam("remote", "remote chain name")
  //   .addParam("remote", "remote contract address")
  .setAction(async (taskArgs: TaskArguments, hre: any) => {
    const { remote } = taskArgs;
    console.info("Enrollment started ...");
    // setting remote for current network, we can create task for it
    const erc20TokenAddress = deploy[hre.network.name];
    const [signer] = await hre.ethers.getSigners();
    const erc20Contract = await hre.ethers.getContractAt(
      abi,
      erc20TokenAddress,
      signer
    );

    // hard coded for polygonmumbai and bsctestnet here
    const remoteChainId = config[remote].chainId;
    const remoteChainType = config[remote].chainType;
    const remoteChainContractAddress = deploy[remote];

    const tx = await erc20Contract.setContractOnChain(
      remoteChainType,
      remoteChainId,
      remoteChainContractAddress
    );

    console.log("trusted remote: tx sent with tx hash ", tx.hash);
    await tx.wait();
    console.log("Added remote to  ", hre.network.name, " to ", remote);
  });
