const { ethers, upgrades, network, run } = require("hardhat");
import { readFile, writeFile } from "node:fs/promises";
import { access, constants, mkdir } from "node:fs";

import config from "./../constants/config";

const isFileExist = (path: string) => {
  return new Promise((resolve, reject) => {
    access(path, constants.F_OK, (err) => {
      if (err) return resolve(false);
      resolve(true);
    });
  });
};

async function main() {
  console.info("Deployment Started ...");

  const ERC20 = await ethers.getContractFactory("ERC20");
  const gatewayContractAddress = config[network.name].gatewayContractAddress;
  const _destGasLimit = 1000000;
  const _initialSupply = 1000;
  const erc20Token = await ERC20.deploy(
    gatewayContractAddress,
    _destGasLimit,
    _initialSupply
  );

  await erc20Token.deployed();
  console.log("ERC20 Token contract deployed to ", erc20Token.address);

  const path = `${__dirname}/artifacts`;

  if (!(await isFileExist(`${path}`))) {
    await new Promise((resolve, reject) => {
      mkdir(path, { recursive: true }, (err) => {
        if (err) return reject("erro while creating dir");
        resolve("created");
      });
    });
  }

  if (!(await isFileExist(`${path}/deploy.json`))) {
    await writeFile(`${path}/deploy.json`, "{}");
  }

  const prevDetails = await readFile(`${path}/deploy.json`, {
    encoding: "utf8",
  });

  const prevDetailsJson: { [network: string]: string } = await JSON.parse(
    prevDetails
  );
  let newDeployData = {
    ...prevDetailsJson,
    [network.name]: erc20Token.address,
  };
  await writeFile(`${path}/deploy.json`, JSON.stringify(newDeployData));
  console.log("Deploy file updated successfully!");

  console.log("Contract verifying..");
  await run(`verify:verify`, {
    address: erc20Token.address,
    constructorArguments: [
      gatewayContractAddress,
      _destGasLimit,
      _initialSupply,
    ],
  });

  console.log("Contract Verified!!");
}

main()
  .then(() => console.info("Deploy complete !!"))
  .catch(console.error);
