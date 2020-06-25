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

class DataConsumer(sp.Contract):
    def __init__(self, oracle):
        self.init(
            oracle = oracle,
            answer = sp.none
        )
        
    @sp.entry_point
    def sendQuery(self, params):
        handler = sp.contract(qType, self.data.oracle, entry_point = "makeQuery").open_some()
        args = sp.record(
            # id = params.id,
            jurisdiction = params.jurisdiction,
            companyNumber = params.companyNumber,
            callback = sp.record(address = sp.to_address(sp.self), entryPoint = "receiveAnswer")
            #sp.contract(rType, sp.to_address(sp.self), entry_point = "receiveAnswer").open_some()
        )
        sp.transfer(args, sp.tez(0), handler)
        
    @sp.entry_point
    def receiveAnswer(self, params):
        sp.set_type(params, rType)
        self.data.answer = sp.some(sp.record(
            jurisdiction = params.jurisdiction,
            companyNumber = params.companyNumber,
            companyName = params.companyName
        ))
        
@sp.add_test(name="BusinessDataOracle Tests")
def test():
    scenario = sp.test_scenario()
    scenario.h1("BusinessDataOracle Tests")
    
    # admin = sp.test_account("Admin")
    # scenario.show(admin)

    # operatorA = sp.test_account("operatorA")
    # scenario.show(operatorA)

    # operatorB = sp.test_account("operatorB")
    # scenario.show(operatorB)

    caller = sp.test_account("caller")
    scenario.show(caller)
    
    consumer = DataConsumer(sp.address("tz1SkSzB2CQSwRJb2MCHUxRyUU6GBD6YjKFe"))
    scenario.register(consumer)
    
    scenario += consumer.sendQuery(id = "TEST1", jurisdiction="UK", companyNumber="1234567").run(sender = caller)
    # scenario += oracle.answerQuery(id = "TEST1", companyName = "Testing Limited").run(sender = operatorA)
    