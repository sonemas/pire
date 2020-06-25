"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var fs = require("fs");
var glob = require("glob");
var axios_1 = require("axios");
var conseiljs_1 = require("conseiljs");
conseiljs_1.setLogLevel('debug');
var tezosNode = 'https://tezos-dev.cryptonomic-infra.tech:443';
var conseilServer = { url: 'https://conseil-dev.cryptonomic-infra.tech:443', apiKey: '40e9dbc7-e93d-452a-aaf5-e675821db4ad', network: 'carthagenet' };
var networkBlockTime = 30 + 1;
var faucetAccount = {};
var keystore;
var oracleAddress;
var consumerAddress;
function clearRPCOperationGroupHash(hash) {
    return hash.replace(/\"/g, '').replace(/\n/, '');
}
function initAccount() {
    return __awaiter(this, void 0, void 0, function () {
        var faucetFiles, keystore;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('~~ initAccount');
                    faucetFiles = glob.sync('tz1*.json');
                    if (faucetFiles.length === 0) {
                        throw new Error('Did not find any faucet files, please go to faucet.tzalpha.net to get one');
                    }
                    console.log("loading " + faucetFiles[0] + " faucet file");
                    faucetAccount = JSON.parse(fs.readFileSync(faucetFiles[0], 'utf8'));
                    return [4 /*yield*/, conseiljs_1.TezosWalletUtil.unlockFundraiserIdentity(faucetAccount['mnemonic'].join(' '), faucetAccount['email'], faucetAccount['password'], faucetAccount['pkh'])];
                case 1:
                    keystore = _a.sent();
                    console.log("public key: " + keystore.publicKey);
                    console.log("secret key: " + keystore.privateKey);
                    console.log("account hash: " + keystore.publicKeyHash);
                    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
                    return [2 /*return*/, keystore];
            }
        });
    });
}
function activateAccount() {
    return __awaiter(this, void 0, void 0, function () {
        var accountRecord, nodeResult, groupid, conseilResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("~~ activateAccount");
                    return [4 /*yield*/, conseiljs_1.TezosConseilClient.getAccount(conseilServer, conseilServer.network, keystore.publicKeyHash)];
                case 1:
                    accountRecord = _a.sent();
                    if (accountRecord !== undefined) {
                        return [2 /*return*/, accountRecord['account_id']];
                    }
                    return [4 /*yield*/, conseiljs_1.TezosNodeWriter.sendIdentityActivationOperation(tezosNode, keystore, faucetAccount['secret'])];
                case 2:
                    nodeResult = _a.sent();
                    groupid = clearRPCOperationGroupHash(nodeResult.operationGroupID);
                    console.log("Injected activation operation with " + groupid);
                    return [4 /*yield*/, conseiljs_1.TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 5, networkBlockTime)];
                case 3:
                    conseilResult = _a.sent();
                    console.log("Activated account at " + conseilResult.pkh);
                    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
                    return [2 /*return*/, conseilResult.pkh];
            }
        });
    });
}
function revealAccount() {
    return __awaiter(this, void 0, void 0, function () {
        var nodeResult, groupid, conseilResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("~~ revealAccount");
                    return [4 /*yield*/, conseiljs_1.TezosNodeReader.isManagerKeyRevealedForAccount(tezosNode, keystore.publicKeyHash)];
                case 1:
                    if (_a.sent()) {
                        return [2 /*return*/, keystore.publicKeyHash];
                    }
                    return [4 /*yield*/, conseiljs_1.TezosNodeWriter.sendKeyRevealOperation(tezosNode, keystore)];
                case 2:
                    nodeResult = _a.sent();
                    groupid = clearRPCOperationGroupHash(nodeResult.operationGroupID);
                    console.log("Injected reveal operation with " + groupid);
                    return [4 /*yield*/, conseiljs_1.TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 5, networkBlockTime)];
                case 3:
                    conseilResult = _a.sent();
                    console.log("Revealed account at " + conseilResult.source);
                    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
                    return [2 /*return*/, conseilResult.source];
            }
        });
    });
}
function deployOracleContract(admin_address) {
    return __awaiter(this, void 0, void 0, function () {
        var contract, storage, fee, _a, nodeResult, groupid, conseilResult;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("~~ deployOracleContract");
                    contract = fs.readFileSync('../../contract/tezos/oracle.tz', 'utf8');
                    storage = "(Pair (Pair \"" + admin_address + "\" {}) (Pair 0 (Pair {} 0)))";
                    _a = Number;
                    return [4 /*yield*/, conseiljs_1.TezosConseilClient.getFeeStatistics(conseilServer, conseilServer.network, conseiljs_1.OperationKindType.Origination)];
                case 1:
                    fee = _a.apply(void 0, [(_b.sent())[0]['high']]);
                    return [4 /*yield*/, conseiljs_1.TezosNodeWriter.sendContractOriginationOperation(tezosNode, keystore, 0, undefined, fee, '', 2000, 100000, contract, storage, conseiljs_1.TezosParameterFormat.Michelson)];
                case 2:
                    nodeResult = _b.sent();
                    console.log('nodeResult: ', nodeResult);
                    groupid = clearRPCOperationGroupHash(nodeResult['operationGroupID']);
                    console.log("Injected origination operation with " + groupid);
                    return [4 /*yield*/, conseiljs_1.TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 5, networkBlockTime)];
                case 3:
                    conseilResult = _b.sent();
                    console.log("Originated contract at " + conseilResult.originated_contracts);
                    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
                    return [2 /*return*/, conseilResult.originated_contracts];
            }
        });
    });
}
function deployConsumerContract(oracle_address) {
    return __awaiter(this, void 0, void 0, function () {
        var contract, storage, fee, _a, nodeResult, groupid, conseilResult;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("~~ deployConsumerContract");
                    contract = fs.readFileSync('../../contract/tezos/consumer.tz', 'utf8');
                    storage = "(Pair None \"" + oracle_address + "\")";
                    _a = Number;
                    return [4 /*yield*/, conseiljs_1.TezosConseilClient.getFeeStatistics(conseilServer, conseilServer.network, conseiljs_1.OperationKindType.Origination)];
                case 1:
                    fee = _a.apply(void 0, [(_b.sent())[0]['high']]);
                    return [4 /*yield*/, conseiljs_1.TezosNodeWriter.sendContractOriginationOperation(tezosNode, keystore, 0, undefined, fee, '', 2000, 100000, contract, storage, conseiljs_1.TezosParameterFormat.Michelson)];
                case 2:
                    nodeResult = _b.sent();
                    console.log('nodeResult: ', nodeResult);
                    groupid = clearRPCOperationGroupHash(nodeResult['operationGroupID']);
                    console.log("Injected origination operation with " + groupid);
                    return [4 /*yield*/, conseiljs_1.TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 5, networkBlockTime)];
                case 3:
                    conseilResult = _b.sent();
                    console.log("Originated contract at " + conseilResult.originated_contracts);
                    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
                    return [2 /*return*/, conseilResult.originated_contracts];
            }
        });
    });
}
function prepareParams(address, entryPointName) {
    var vars = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        vars[_i - 2] = arguments[_i];
    }
    return __awaiter(this, void 0, void 0, function () {
        var entryPoints, _a, entryPoints_1, entryPoint;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, conseiljs_1.TezosContractIntrospector.generateEntryPointsFromAddress(conseilServer, conseilServer.network, address)];
                case 1:
                    entryPoints = _b.sent();
                    for (_a = 0, entryPoints_1 = entryPoints; _a < entryPoints_1.length; _a++) {
                        entryPoint = entryPoints_1[_a];
                        if (entryPoint.name === entryPointName) {
                            console.log('~~ Found entrypoint');
                            return [2 /*return*/, entryPoint.generateInvocationString(vars)];
                        }
                    }
                    throw 'Entry point found';
            }
        });
    });
}
function parseContract(address) {
    return __awaiter(this, void 0, void 0, function () {
        var entryPoints, _i, entryPoints_2, entryPoint;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, conseiljs_1.TezosContractIntrospector.generateEntryPointsFromAddress(conseilServer, conseilServer.network, address)];
                case 1:
                    entryPoints = _a.sent();
                    for (_i = 0, entryPoints_2 = entryPoints; _i < entryPoints_2.length; _i++) {
                        entryPoint = entryPoints_2[_i];
                        console.log(entryPoint.name + "(" + entryPoint.parameters.map(function (p) { return (p.name ? p.name + ': ' : '') + p.type + (p.optional ? '?' : ''); }).join(', ') + ")");
                        console.log(entryPoint.structure);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
var Query = /** @class */ (function () {
    function Query(id, jurisdiction, companyNumber) {
        this.id = id;
        this.jurisdiction = jurisdiction;
        this.companyNumber = companyNumber;
    }
    return Query;
}());
function invokeContract(address, parameter, entrypoint) {
    if (entrypoint === void 0) { entrypoint = ''; }
    return __awaiter(this, void 0, void 0, function () {
        var fee, _a, storageResult, gasCost, storageCost, _b, gas, freight, _c, _d, _e, _f, _g, nodeResult, groupid, conseilResult;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    console.log("~~ invokeContract");
                    _a = Number;
                    return [4 /*yield*/, conseiljs_1.TezosConseilClient.getFeeStatistics(conseilServer, conseilServer.network, conseiljs_1.OperationKindType.Transaction)];
                case 1:
                    fee = _a.apply(void 0, [(_h.sent())[0]['high']]);
                    return [4 /*yield*/, conseiljs_1.TezosNodeReader.getContractStorage(tezosNode, address)];
                case 2:
                    storageResult = _h.sent();
                    console.log("initial storage: " + JSON.stringify(storageResult));
                    gasCost = 100000;
                    storageCost = 2000;
                    return [4 /*yield*/, conseiljs_1.TezosNodeWriter.testContractInvocationOperation(tezosNode, 'main', keystore, address, 10000, fee, storageCost, gasCost, entrypoint, parameter, conseiljs_1.TezosParameterFormat.Michelson)];
                case 3:
                    _b = _h.sent(), gas = _b.gas, freight = _b.storageCost;
                    _d = (_c = console).log;
                    _e = "cost: ";
                    _g = (_f = JSON).stringify;
                    return [4 /*yield*/, conseiljs_1.TezosNodeWriter.testContractInvocationOperation(tezosNode, 'main', keystore, address, 10000, fee, storageCost, gasCost, entrypoint, parameter, conseiljs_1.TezosParameterFormat.Michelson)];
                case 4:
                    _d.apply(_c, [_e + _g.apply(_f, [_h.sent()])]);
                    return [4 /*yield*/, conseiljs_1.TezosNodeWriter.sendContractInvocationOperation(tezosNode, keystore, address, 10000, fee, '', storageCost, gasCost, entrypoint, parameter, conseiljs_1.TezosParameterFormat.Michelson)];
                case 5:
                    nodeResult = _h.sent();
                    groupid = clearRPCOperationGroupHash(nodeResult.operationGroupID);
                    console.log("Injected transaction(invocation) operation with " + groupid);
                    return [4 /*yield*/, conseiljs_1.TezosConseilClient.awaitOperationConfirmation(conseilServer, conseilServer.network, groupid, 5, networkBlockTime)];
                case 6:
                    conseilResult = _h.sent();
                    console.log("Completed invocation of " + conseilResult.destination);
                    return [4 /*yield*/, conseiljs_1.TezosNodeReader.getContractStorage(tezosNode, address)];
                case 7:
                    storageResult = _h.sent();
                    console.log("modified storage: " + JSON.stringify(storageResult));
                    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
                    return [2 /*return*/];
            }
        });
    });
}
function getOracleQueries() {
    return __awaiter(this, void 0, void 0, function () {
        var storage, key, index, hashedKey, queries;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("~~ getOracleQueries");
                    return [4 /*yield*/, conseiljs_1.TezosNodeReader.getContractStorage(tezosNode, oracleAddress)];
                case 1:
                    storage = _a.sent();
                    key = storage.args[1].args[0].int;
                    index = storage.args[1].args[1].args[0].int;
                    hashedKey = conseiljs_1.TezosMessageUtils.encodeBigMapKey(key);
                    console.log("index: " + index + ", key: " + key + ", hashedKey: " + hashedKey);
                    return [4 /*yield*/, conseiljs_1.TezosNodeReader.getValueForBigMapKey(tezosNode, index, hashedKey)];
                case 2:
                    queries = _a.sent();
                    console.log(queries);
                    return [2 /*return*/, []];
            }
        });
    });
}
function sendQuery(jurisdiction, company_number) {
    return __awaiter(this, void 0, void 0, function () {
        var params;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    params = "(Pair \"" + company_number + "\" \"" + jurisdiction + "\")";
                    return [4 /*yield*/, invokeContract(consumerAddress, params, 'sendQuery')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function answerQuery(id, jurisdiction, companyNumber) {
    return __awaiter(this, void 0, void 0, function () {
        var company, params;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('~~ answer query');
                    if (jurisdiction.toUpperCase() !== 'UK') {
                        throw "Only UK is supported for now";
                    }
                    return [4 /*yield*/, getCompanyData(companyNumber)];
                case 1:
                    company = _a.sent();
                    params = "(Pair \"" + company.CompanyName + "\" " + id + ")";
                    return [4 /*yield*/, invokeContract(oracleAddress, params, 'answerQuery')];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getCompanyData(companyNumber) {
    return __awaiter(this, void 0, void 0, function () {
        var url, company, exception_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = "http://data.companieshouse.gov.uk/doc/company/" + companyNumber + ".json";
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1["default"].get(url)];
                case 2:
                    company = _a.sent();
                    return [2 /*return*/, company.data.primaryTopic];
                case 3:
                    exception_1 = _a.sent();
                    process.stderr.write("ERROR received from " + url + ": " + exception_1 + "\n");
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, initAccount()];
                case 1:
                    // Account initialization
                    keystore = _a.sent(); // TODO: read/write settings
                    console.log(keystore);
                    return [4 /*yield*/, activateAccount()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, revealAccount()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, deployOracleContract(keystore.publicKeyHash)];
                case 4:
                    // Deploy Oracle contract
                    // contractAddress = await deployMichelsonContract();
                    oracleAddress = _a.sent();
                    // const entryPoints = await TezosContractIntrospector.generateEntryPointsFromAddress(conseilServer, conseilServer.network, oracleAddress);
                    // const params = await entryPoints[3].generateInvocationString([keystore.publicKeyHash]);
                    // console.log(entryPoints[3].name, ": ", params);
                    return [4 /*yield*/, invokeContract(oracleAddress, "{\"" + keystore.publicKeyHash + "\"}", 'updateOperatorList')];
                case 5:
                    // const entryPoints = await TezosContractIntrospector.generateEntryPointsFromAddress(conseilServer, conseilServer.network, oracleAddress);
                    // const params = await entryPoints[3].generateInvocationString([keystore.publicKeyHash]);
                    // console.log(entryPoints[3].name, ": ", params);
                    _a.sent();
                    return [4 /*yield*/, deployConsumerContract(oracleAddress)];
                case 6:
                    consumerAddress = _a.sent();
                    console.log('~~ oracle contract address:', oracleAddress);
                    console.log('~~ consumer contract address:', consumerAddress);
                    // console.log('~~ consumer contract endpoints');
                    // await parseContract(consumerAddress);
                    // console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
                    // console.log('~~ oracle contract endpoints');
                    // await parseContract(oracleAddress);
                    // console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
                    return [4 /*yield*/, sendQuery('UK', '12068026')];
                case 7:
                    // console.log('~~ consumer contract endpoints');
                    // await parseContract(consumerAddress);
                    // console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
                    // console.log('~~ oracle contract endpoints');
                    // await parseContract(oracleAddress);
                    // console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
                    _a.sent();
                    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
                    return [4 /*yield*/, answerQuery(0, 'UK', '12068026')];
                case 8:
                    _a.sent();
                    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
                    console.log("All steps have been successfully executed.");
                    console.log("View the oracle contract: https://better-call.dev/carthagenet/" + oracleAddress);
                    console.log("View the consumer contract: https://better-call.dev/carthagenet/" + consumerAddress);
                    return [2 /*return*/];
            }
        });
    });
}
run();
