import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const { ethers } = require("hardhat");
import { assert } from "console";
import deploy from "../deploy/artifacts/deploy.json";
import { abi } from "../artifacts/contracts/ERC20.sol/ERC20.json";
import config from "../constants/config";

async function main() {
  const localChain = "polygonmumbai";
  // const remoteChain = "goerli";
  const remoteChain = "bsctestnet";
  const jsonURLLocalChain =
    "https://polygon-mumbai.g.alchemy.com/v2/mTfNmVbF3-tovNs2n5vUpUzy4BfXAVcg";
  // const jsonURLRemoteChain =
  //   "https://goerli.infura.io/v3/f4d139222fce4c03963c4145d0a30260";

  const jsonURLRemoteChain = "https://data-seed-prebsc-1-s1.binance.org:8545/";
  const localChainId = config[localChain].chainId;
  const remoteChainId = config[remoteChain].chainId;
  const localChainType = config[localChain].chainType;
  const remoteChainType = config[remoteChain].chainType;

  let signerOrigin: SignerWithAddress;
  let signerRemote: SignerWithAddress;

  let remoteChainProvider;
  let localChainProvider;

  let erc20TokenSrcContract: any;
  let erc20TokenDstContract: any;

  let signer: SignerWithAddress;

  const setup = async () => {
    signer = ethers.Wallet.fromMnemonic(process.env.MNEMONIC);
    localChainProvider = new ethers.providers.JsonRpcProvider(
      jsonURLLocalChain
    );
    remoteChainProvider = new ethers.providers.JsonRpcProvider(
      jsonURLRemoteChain
    );

    signerOrigin = signer.connect(localChainProvider);
    signerRemote = signer.connect(remoteChainProvider);

    erc20TokenSrcContract = await ethers.getContractAt(
      abi,
      deploy[localChain],
      signerOrigin
    );

    erc20TokenDstContract = await ethers.getContractAt(
      abi,
      deploy[remoteChain],
      signerRemote
    );
  };

  const testTokenTransferFlow = async () => {
    const balanceOnDstBeforeTransfer = await erc20TokenDstContract
      .connect(signerRemote)
      .balanceOf(signer.address);
    // let's transfer token token from src to dst
    const expiryDurationInSeconds = 0; // for infinity
    const destGasPrice = (await remoteChainProvider.getGasPrice()).mul(26);
    // console.log(destGasPrice);
    // console.log(ethers.utils.formatUnits(destGasPrice, "gwei"));

    // return;

    // .div(2);

    const to = signer.address;
    const amount = ethers.BigNumber.from("1000000000000000000");
    const tx = await erc20TokenSrcContract
      .connect(signerOrigin)
      .transferCrossChain(
        remoteChainType,
        remoteChainId,
        expiryDurationInSeconds,
        destGasPrice,
        to,
        amount,
        {
          gasLimit: 500000,
        }
      );
    console.log("Crosschain Transfer: tx sent with hash ", tx.hash);
    await tx.wait();
    console.log("Crosschain Transfer: went successful");
    // on src chain balance should be decreased by amount
    const balanceOnSrc = await erc20TokenSrcContract
      .connect(signerOrigin)
      .balanceOf(signer.address);
    assert(
      await erc20TokenSrcContract
        .connect(signerOrigin)
        .balanceOf(signer.address),
      balanceOnSrc.sub(amount)
    );

    // wait here before checking it on destination chain as it will check some time to relay message to dstchain
    console.log("Waiting for transfer to process on dst chain...");
    setTimeout(() => {
      (async () => {
        assert(
          await erc20TokenDstContract
            .connect(signerRemote)
            .balanceOf(signer.address),
          balanceOnDstBeforeTransfer.add(amount)
        );
      })();
    }, 5 * 60 * 1000); // after 5min
  };

  setup()
    .then(async () => {
      console.log("Setup completed !!");
      await testTokenTransferFlow();
    })
    .catch(console.log);
}

main()
  .then(() => console.info("Test completed cross chain !!"))
  .catch(console.error);
