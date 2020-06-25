import * as fs from 'fs';
import * as glob from 'glob';
import BigNumber from 'bignumber.js';
import * as dotenv from 'dotenv';
import * as express from 'express';
import * as path from 'path';
import * as bodyParser from 'body-parser';
import axios from 'axios';

import { TezosConseilClient, TezosWalletUtil, TezosNodeWriter, setLogLevel, TezosParameterFormat, KeyStore, OperationKindType, TezosNodeReader, TezosContractIntrospector, ConseilOutput, TezosMessageUtils } from 'conseiljs';

setLogLevel('debug');
dotenv.config();

const tezosNode = 'https://tezos-dev.cryptonomic-infra.tech:443';
const conseilServer = { url: 'https://conseil-dev.cryptonomic-infra.tech:443', apiKey: '40e9dbc7-e93d-452a-aaf5-e675821db4ad', network: 'carthagenet' };
const networkBlockTime = 30 + 1;

let faucetAccount = {};
let keystore: KeyStore;
let oracleAddress: string;
let consumerAddress: string;

function clearRPCOperationGroupHash(hash: string) {
    return hash.replace(/\"/g, '').replace(/\n/, '');
}

async function initAccount(): Promise<KeyStore> {
    console.log('~~ initAccount');
    let faucetFiles: string[] = glob.sync('tz1*.json');

    if (faucetFiles.length === 0) {
        throw new Error('Did not find any faucet files, please go to faucet.tzalpha.net to get one');
    }

    console.log(`loading ${faucetFiles[0]} faucet file`);
    faucetAccount = JSON.parse(fs.readFileSync(faucetFiles[0], 'utf8'));

    const keystore = await TezosWalletUtil.unlockFundraiserIdentity(faucetAccount['mnemonic'].join(' '), faucetAccount['email'], faucetAccount['password'], faucetAccount['pkh']);
    console.log(`public key: ${keystore.publicKey}`);
    console.log(`secret key: ${keystore.privateKey}`);
    console.log(`account hash: ${keystore.publicKeyHash}`);
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');

    return keystore;
}

async function activateAccount(): Promise<string> {
    console.log(`~~ activateAccount`);
    const accountRecord = await TezosConseilClient.getAccount(conseilServer, conseilServer.network, keystore.publicKeyHash);
    if (accountRecord !== undefined) { return accountRecord['account_id']; }

    const nodeResult = await TezosNodeWriter.sendIdentityActivationOperation(tezosNode, keystore, faucetAccount['secret']);
    const groupid = clearRPCOperationGroupHash(nodeResult.operationGroupID);
    console.log(`Injected activation operation with ${groupid}`);

    const conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 5, networkBlockTime);
    console.log(`Activated account at ${conseilResult.pkh}`);
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    return conseilResult.pkh;
}

async function revealAccount(): Promise<string> {
    console.log(`~~ revealAccount`);
    if (await TezosNodeReader.isManagerKeyRevealedForAccount(tezosNode, keystore.publicKeyHash)) {
        return keystore.publicKeyHash;
    }

    const nodeResult = await TezosNodeWriter.sendKeyRevealOperation(tezosNode, keystore);
    const groupid = clearRPCOperationGroupHash(nodeResult.operationGroupID);
    console.log(`Injected reveal operation with ${groupid}`);

    const conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 5, networkBlockTime);
    console.log(`Revealed account at ${conseilResult.source}`);
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    return conseilResult.source;
}

async function deployOracleContract(admin_address: string): Promise<string> {
    console.log(`~~ deployOracleContract`);
    const contract = fs.readFileSync('../../contract/tezos/oracle.tz', 'utf8')
    // const storage = `("${admin_address}" ({} {}))`;
    // const storage = `(Pair "${admin_address}" (Pair {} {}))`
    const storage = `(Pair (Pair "${admin_address}" {}) (Pair 0 (Pair {} 0)))`

    const fee = Number((await TezosConseilClient.getFeeStatistics(conseilServer, conseilServer.network, OperationKindType.Origination))[0]['high']);

    const nodeResult = await TezosNodeWriter.sendContractOriginationOperation(tezosNode, keystore, 0, undefined, fee, '', 2000, 100000, contract, storage, TezosParameterFormat.Michelson);
    console.log('nodeResult: ', nodeResult);
    const groupid = clearRPCOperationGroupHash(nodeResult['operationGroupID']);
    console.log(`Injected origination operation with ${groupid}`);

    const conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 5, networkBlockTime);
    console.log(`Originated contract at ${conseilResult.originated_contracts}`);
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    return conseilResult.originated_contracts;
}

async function deployConsumerContract(oracle_address: string): Promise<string> {
    console.log(`~~ deployConsumerContract`);
    const contract = fs.readFileSync('../../contract/tezos/consumer.tz', 'utf8')
    const storage = `(Pair None "${oracle_address}")`
    const fee = Number((await TezosConseilClient.getFeeStatistics(conseilServer, conseilServer.network, OperationKindType.Origination))[0]['high']);
    
    const nodeResult = await TezosNodeWriter.sendContractOriginationOperation(tezosNode, keystore, 0, undefined, fee, '', 2000, 100000, contract, storage, TezosParameterFormat.Michelson);
    console.log('nodeResult: ', nodeResult);
    const groupid = clearRPCOperationGroupHash(nodeResult['operationGroupID']);
    console.log(`Injected origination operation with ${groupid}`);

    const conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 5, networkBlockTime);
    console.log(`Originated contract at ${conseilResult.originated_contracts}`);
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    return conseilResult.originated_contracts;
}

async function prepareParams(address: string, entryPointName: string, ...vars: any[]): Promise<string> {
    const entryPoints = await TezosContractIntrospector.generateEntryPointsFromAddress(conseilServer, conseilServer.network, address);
    for (const entryPoint of entryPoints) {
        if (entryPoint.name === entryPointName) {
            console.log('~~ Found entrypoint');
            return entryPoint.generateInvocationString(vars);
        }
    }
    throw 'Entry point found';

}

async function parseContract(address: string) {
    const entryPoints = await TezosContractIntrospector.generateEntryPointsFromAddress(conseilServer, conseilServer.network, address);
    for (const entryPoint of entryPoints) {
        console.log(`${entryPoint.name}(${entryPoint.parameters.map(p => (p.name ? p.name + ': ' : '') + p.type + (p.optional ? '?' : '')).join(', ')})`)
        console.log(entryPoint.structure)
    }
}

class Query {
    id: string;
    jurisdiction: string;
    companyNumber: string;

    constructor(id: string, jurisdiction: string, companyNumber: string) {
        this.id = id;
        this.jurisdiction = jurisdiction;
        this.companyNumber = companyNumber;
    }
}

async function invokeContract(address: string, parameter: string, entrypoint: string = '') {
    console.log(`~~ invokeContract`);
    const fee = Number((await TezosConseilClient.getFeeStatistics(conseilServer, conseilServer.network, OperationKindType.Transaction))[0]['high']);

    let storageResult = await TezosNodeReader.getContractStorage(tezosNode, address);
    console.log(`initial storage: ${JSON.stringify(storageResult)}`);
    
    const gasCost = 100000;
    const storageCost = 2000;
    const { gas, storageCost: freight } = await TezosNodeWriter.testContractInvocationOperation(tezosNode, 'main', keystore, address, 10000, fee, storageCost, gasCost, entrypoint, parameter, TezosParameterFormat.Michelson);

    console.log(`cost: ${JSON.stringify(await TezosNodeWriter.testContractInvocationOperation(tezosNode, 'main', keystore, address, 10000, fee, storageCost, gasCost, entrypoint, parameter, TezosParameterFormat.Michelson))}`)
    const nodeResult = await TezosNodeWriter.sendContractInvocationOperation(tezosNode, keystore, address, 10000, fee, '', storageCost, gasCost, entrypoint, parameter, TezosParameterFormat.Michelson);

    const groupid = clearRPCOperationGroupHash(nodeResult.operationGroupID);
    console.log(`Injected transaction(invocation) operation with ${groupid}`);

    const conseilResult = await TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 5, networkBlockTime);
    console.log(`Completed invocation of ${conseilResult.destination}`);
    storageResult = await TezosNodeReader.getContractStorage(tezosNode, address);
    console.log(`modified storage: ${JSON.stringify(storageResult)}`);
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
}

async function getOracleQueries(): Promise<Query[]> {
    console.log(`~~ getOracleQueries`);
    // const oracle = await TezosConseilClient.getAccount(conseilServer, conseilServer.network, oracleAddress);
    const storage = await TezosNodeReader.getContractStorage(tezosNode, oracleAddress);
    // console.table(storage);
    const key = storage.args[1].args[0].int;
    const index = storage.args[1].args[1].args[0].int;
    const hashedKey = TezosMessageUtils.encodeBigMapKey(key);
    console.log(`index: ${index}, key: ${key}, hashedKey: ${hashedKey}`);
    
    const queries = await TezosNodeReader.getValueForBigMapKey(tezosNode, index, hashedKey);
    console.log(queries);
    return [];

    // if (accountRecord !== undefined) { return accountRecord['account_id']; }

}

async function sendQuery(jurisdiction: string, company_number: string) {
    // const entryPoints = await TezosContractIntrospector.generateEntryPointsFromAddress(conseilServer, conseilServer.network, consumerAddress);
    // const params = await entryPoints[1].generateInvocationString(company_number, Math.round((new Date()).getTime() / 1000), jurisdiction);
    // console.log(entryPoints[1].name, ": ", params);
   
    // const params = prepareParams(consumerAddress, 'sendQuery', company_number, Math.round((new Date()).getTime() / 1000), jurisdiction);
   
    // sendQuery(companyNumber: string, jurisdiction: string)
    // (Right (Pair $PARAM $PARAM))

    const params = `(Pair "${company_number}" "${jurisdiction}")`
    await invokeContract(consumerAddress, params, 'sendQuery');
}

async function answerQuery(id: number, jurisdiction: string, companyNumber: string) {
    console.log('~~ answer query');
    if (jurisdiction.toUpperCase() !== 'UK') {
        throw "Only UK is supported for now";
    }

    const company = await getCompanyData(companyNumber);
    // answerQuery(companyName: string, id: nat)
    // (Left (Left (Pair $PARAM $PARAM)))
    const params = `(Pair "${company.CompanyName}" ${id})`
    await invokeContract(oracleAddress, params, 'answerQuery');
}

async function run() {
    // Account initialization
    keystore = await initAccount(); // TODO: read/write settings
    console.log(keystore);
    await activateAccount();
    await revealAccount();

    // Deploy Oracle contract
    // contractAddress = await deployMichelsonContract();
    oracleAddress = process.env.ORACLE_CONTRACT_ADDRESS || undefined;
    if (oracleAddress === undefined) {
        oracleAddress = await deployOracleContract(keystore.publicKeyHash);
        // const entryPoints = await TezosContractIntrospector.generateEntryPointsFromAddress(conseilServer, conseilServer.network, oracleAddress);
        // const params = await entryPoints[3].generateInvocationString([keystore.publicKeyHash]);
        // console.log(entryPoints[3].name, ": ", params);
        await invokeContract(oracleAddress, `{"${keystore.publicKeyHash}"}`, 'updateOperatorList');
    } else {
        console.log('~~ using oracle address from ENV');
    }

    consumerAddress = process.env.CONSUMER_CONTRACT_ADDRESS || undefined;
    if (consumerAddress === undefined) {
        consumerAddress = await deployConsumerContract(oracleAddress);
    } else {
        console.log('~~ using consumer address from ENV');
    }

    console.log('~~ oracle contract address:', oracleAddress);
    console.log('~~ consumer contract address:', consumerAddress);

    console.log('~~ consumer contract endpoints');
    await parseContract(consumerAddress);
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');

    console.log('~~ oracle contract endpoints');
    await parseContract(oracleAddress);
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
   
    
    // await invokeContract(contractAddress, '"new text"');
}

// class RegAddress {
//     Careof: string;
//     POBox: string;
//     AddressLine1: string;
//     AddressLine2: string;
//     PostTown: string;
//     County: string;
//     Country: string;
//     Postcode: string;

//     constructor(
//         Careof: string,
//         POBox: string,
//         AddressLine1: string,
//         AddressLine2: string,
//         PostTown: string,
//         County: string,
//         Country: string,
//         Postcode: string,
//     ) {
//         this.Careof = Careof;
//         this.POBox = POBox;
//         this.AddressLine1 = AddressLine1;
//         this.AddressLine2 = AddressLine2;
//         this.PostTown = PostTown;
//         this.County = County;
//         this.Country = Country;
//         this.Postcode = Postcode;
//     }
// }

// class Company {
//     CompanyName: string;
//     CompanyNumber: string;
//     RegAddress: RegAddress;
    
// }

async function getCompanyData(companyNumber: string) {
    const url = `http://data.companieshouse.gov.uk/doc/company/${companyNumber}.json`;
    try {
        const company = await axios.get(url);
        return company.data.primaryTopic;
    } catch (exception) {
        process.stderr.write(`ERROR received from ${url}: ${exception}\n`);
    }
}

// run();

const app: express.Application = express();
// app.use(express.static('assets'));
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));
app.use(express.json());       // to support JSON-encoded bodies
app.use(express.urlencoded()); // to support URL-encoded bodies

// Configure Express to use EJS
app.set( "views", path.join( __dirname, "views" ) );
app.set( "view engine", "ejs" );

app.get('/', async function (req, res) {
    let queries = await getOracleQueries();
    res.render('index', {queries});
});

app.post('/send_query', async function (req, res) {
    console.log(req.body);
    try {
        await sendQuery('UK', req.body.companyNumber);
    } catch(e) {
        console.log(e);
    }
    
    res.redirect('/');
});
  
app.listen(3000, function () {
    // getCompanyData('02050399');
    run();
    answerQuery(0, "UK", "02050399");
    console.log('Listening on port 3000!');
});