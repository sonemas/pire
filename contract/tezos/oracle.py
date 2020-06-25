import smartpy as sp

rType = sp.TRecord(
    jurisdiction = sp.TString,
    companyNumber = sp.TString,
    companyName = sp.TString
)

qType = sp.TRecord(
    jurisdiction = sp.TString,
    companyNumber = sp.TString,
    callback = sp.TRecord(
        address = sp.TAddress,
        entryPoint = sp.TString
    ) #sp.TContract(rType)
)

class BusinessDataOracle(sp.Contract):
    def __init__(self, admin):
        self.init(
            admin = admin,
            operators = sp.set(),
            queryIndex = 0,
            oracleIndex = 0,
            queries = sp.big_map(
                tkey = sp.TNat, 
                tvalue = sp.TRecord(
                    jurisdiction = sp.TString,
                    companyNumber = sp.TString,
                    callback = sp.TRecord(address = sp.TAddress, entryPoint = sp.TString) #sp.TContract(rType)
                )
            )
        )

    @sp.entry_point
    def makeQuery(self, params):
        index = sp.local('index', self.data.queryIndex)
        self.data.queryIndex += 1
        self.data.queries[index.value] = sp.record(
            jurisdiction = params.jurisdiction, 
            companyNumber = params.companyNumber, 
            callback = params.callback
        )

    @sp.entry_point
    def answerQuery(self, params):
        sp.verify(self.data.operators.contains(sp.sender), message = "Privileged operation")
        sp.verify(self.data.queries.contains(params.id), message = "Query doesn't exist")
        
        args = sp.record(
            jurisdiction = self.data.queries[params.id].jurisdiction,
            companyNumber = self.data.queries[params.id].companyNumber,
            companyName = params.companyName
        )
        
        address = self.data.queries[params.id].callback.address
        # TODO: Fix bug and remove hard coded entrypoint.
        entry_point = "receiveAnswer" # self.data.queries[params.id].callback.entryPoint
        callback = sp.contract(rType, address , entry_point = entry_point).open_some()
        sp.transfer(
            args,
            sp.tez(0),
            callback
        )
        
    @sp.entry_point
    def updateOperatorList(self, params):
        sp.verify(sp.sender == self.data.admin, message = "Privileged operation")
        self.data.operators = params.operators
    
    @sp.entry_point
    def updateAdmin(self, params):
        sp.verify(sp.sender == self.data.admin, message = "Privileged operation")
        self.data.admin = params.admin
        
@sp.add_test(name="BusinessDataOracle Tests")
def test():
    scenario = sp.test_scenario()
    scenario.h1("BusinessDataOracle Tests")
    
    admin = sp.test_account("Admin")
    scenario.show(admin)

    operatorA = sp.test_account("operatorA")
    scenario.show(operatorA)

    operatorB = sp.test_account("operatorB")
    scenario.show(operatorB)

    caller = sp.test_account("caller")
    scenario.show(caller)
    
    oracle = BusinessDataOracle(admin.address)
    scenario.register(oracle)
    
    scenario += oracle.updateOperatorList(operators = sp.set([operatorA.address, operatorB.address])).run(sender = admin)
    
    consumer = DataConsumer(oracle.address)
    scenario.register(consumer)
    
    scenario += consumer.sendQuery(jurisdiction="UK", companyNumber="1234567").run(sender = caller)
    scenario += consumer.sendQuery(jurisdiction="UK", companyNumber="7654321").run(sender = caller)
    scenario += oracle.answerQuery(id = 0, companyName = "Testing Limited").run(sender = operatorA)
    