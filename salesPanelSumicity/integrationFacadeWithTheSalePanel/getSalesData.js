/**
* O método permite obter os dados principais da venda para o painel de monitoramento de vendas.
*
* @input
* { 
*   sellers: [_id_do_vendedor_1, _id: id_do_vendedor_2, _id: id_do_vendedor_3](Obrigatório)
*   period: (string) - "today", last5Days", "last10Days", "last20Days", "currentMonth", "lastMonth" ou "perPeriod" (Obrigatório)
*   cpfCnpj: (number) - (Opcional)
*   from: (date ISOString) - (Obrigatório caso o "period" for "perPeriod")
*   until: (date ISOString) - (Obrigatório caso o "period" for "perPeriod")
*   order: (string) - (Obrigatório)
*   page: (number) - (Obrigatório)
*   customerName": (string) - (Opcional),
*   regionalId: [array] (string) - (Opcional),
*   status: [array] (string) - (Opcional) -> Valores possíveis ("aborted", "error", "open", "finished" e "completing"),
*   externalCode: (number) - (Opcional),
*   saleStatus: [array] )(string) - (Opcional)
*   salesChannelIds: [array] (string) - (Opcional)
* }
* 
* @output para Erro:
*   _output: {
*       status: 400
*       message: Motivo_do_erro
*   }
* 
* @output para Sucesso:
*   _output: {
*       status: 200
*       pages: (number) - Total de paginas
*       totalResults: (number) -  Total de resultados
*       message: "Sucesso."
*       sales: [{
*           saleCreationDate: (date ISOString) - Data de criação da venda
*           cpfCnpj: (number) - CPF ou CNPJ do prospecto/cliente e 
*           currentSaleState: (string) - Nome do status atual da venda
*           prospectName: (string) - Nome do prospecto/cliente, 
*           salesChannelName: (string) - Nome do canal de venda,
*           saleId: (string) - Id da venda,
*           tagColor: (string) - Cor da tag de status do processo -> Valores possíveis ("blue", "green", "yellow"). 
*       }]
*   }
*/

const CANCELED_SALE_STATUS_ID = "5ea34de6e2a4942ab81c110f";
const CANCELED_FOR_IDLENESS_SALE_STATUS_ID = "609d12f421926828cd18220c";
const CANCELING_FOR_IDLENESS_SALE_STATUS_ID = "602e7810dada4448608fe64b";
const FINISHED_SALE_STATUS_ID = "5e99c111abc8283d1effdb10";
const FINISHED_STATUS_ID = "595c20500190000000000002";
let taskTree = [];
let sales = [];
let salesPerPage = [];
let lastOffset = [];
let sortValue = "";
let sortOrder = "";
let totalResults;

if(validateInput()) {
    configurePage();
    generateOutput();
}

//-------------------Funções Principais-------------------

// Valida as entradas
function validateInput() {
    if (!_input) {
        generateOutput("Não há dados de entrada!");
        return false;
    }else if(!validateSellersInput() || !validatePeriodInput() || !validateOrderPage()){
        return false;
    }
    return true;
}

// Configura a busca paginada
function configurePage() {
    const paginations = Math.trunc(_input.page / 1000);
    let cont = 0;
    let pagePosition;
    
    if(_input.page <= 1000) {
        pagePosition = (_input.page - 1) * 10;
        salesPerPage = searchSalesData(pagePosition, 10);
        getAllSales(salesPerPage);
    }else {
        do{
            if(paginations === 0) {
                pagePosition = (_input.page - (paginations * 1000) - 1) * 10;
                salesPerPage = searchSalesData(pagePosition, 10);
                getAllSales(salesPerPage);
            } else if(paginations === cont) {
                pagePosition = (_input.page - (paginations * 1000) - 1) * 10;
                salesPerPage = searchSalesData(0, 9999);
                salesPerPage.hits = salesPerPage.hits.map((sale, index) => {
                    if(index > pagePosition && index < (pagePosition + 10)) {
                        return sale;
                    } else {
                        return null;
                    }
                }).filter(sale => sale !== null);
                getAllSales(salesPerPage);
            } else {
                salesPerPage = searchSalesData(9999, 1);
                lastOffset = salesPerPage.hits[(salesPerPage.hits.length - 1)].sort;
            }
            cont += 1;
        } while(paginations >= cont);
    }
    totalResults = salesPerPage.total;
}

// Faz a busca das vendas de acordo com os parametros de entrada 
function searchSalesData(pagePosition, searchSize) {
    
    let rangeDate = getRange();
    
    let query = {
        "query": {
            "bool": {
                "must": [
                    {
                        "terms": {
                            "responsibleForSale._id": _input.sellers
                        }
                    },
                    rangeDate
                ],
                "should": [],
                "minimum_should_match": 0
            }
        },
        "size": searchSize,
        "from": pagePosition,
        "sort": [],
        "_source": false
    };
    if(_input.customerName){
        let prospectNameArray = _input.customerName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,"").split(" ");
        prospectNameArray.forEach(name => {
            query.query.bool.must.push({ "wildcard": {
                "prospect.name": {
                    "value": ("*" + name + "*")
                    }
                }
            });
        });
    }
    
    if(_input.externalCode){
        query.query.bool.must.push({ "term": {
                "airContractCode.keyword": _input.externalCode
            }
        });
    }
    if(_input.status && _input.status.length > 0){
        query.query.bool.must.push({ "terms": {
                "_status.identifier.keyword": _input.status
            }
        });
    }
    if(_input.regionalId  && _input.regionalId.length > 0){
        query.query.bool.must.push({ "terms": {
                "regional._id": _input.regionalId
            }
        });
    }
    if(_input.salesChannelIds && _input.salesChannelIds.length > 0){
        query.query.bool.must.push({ "terms": {
                "salesChannel._id": _input.salesChannelIds
            }
        });
    }
    
    if(_input.cpfCnpj) {
        
        let cpfCnpj = _input.cpfCnpj;
        
        query.query.bool.should.push(
            {
                "wildcard": {
                    "cpf": {
                        "value": ("*" + cpfCnpj + "*")
                    }
                }
            },
            {
                "wildcard": {
                    "cnpj": {
                        "value": ("*" + cpfCnpj + "*")
                    }
                }
            }
        );
        query.query.bool.minimum_should_match += 1;
    }
    
    if(_input.saleStatus && _input.saleStatus.length >0){
        
        let statusFilters = getStatusFilters(_input.saleStatus);
        
        query.query.bool.should.push(
            { 
                "terms": {
                "saleStatus._id": statusFilters
                }
            },
            { 
                "terms": {
                "saleStatusBeforeCancelation._id": statusFilters
                }
            }
        );
        query.query.bool.minimum_should_match += 1;
    }
    
    if(lastOffset.length === 2){
        query.search_after = lastOffset;
    }
    query.sort = getOrder();
    return _process.venda.current._search(query).hits; 
}

// Busca por todas as vendas
function getAllSales(salesPerPage) {
    if (salesPerPage.hits.length > 0) {
        sales = sales.concat(salesPerPage.hits.map(sale => {
            return getReturn(sale);
        }));
    }
}

// Gera mensagem de erro
function generateOutput(message) {
    if (message) { // Se há uma mensagem, gera uma mensagem de erro
        _output = {
            "status": 400,
            "message": message
        };
    } else {
        _output = {
            "status": 200,
            "message": "Sucesso",
            "sales": sales,
            "totalResults": totalResults,
            "pages": Math.ceil(totalResults / 10)
        };
    }
}

//-------------------Funções Auxiliares-----------------------

// Valida a entrada period. Se ela existe, se está dentro das opções válidas
function validatePeriodInput() {
    if (!_input.period) {
        generateOutput("Não foi informado o periodo!");
        return false;
    }
    if (_input.period !== "today" && _input.period !== "last5Days" && _input.period !== "last10Days" && _input.period !== "last20Days" && _input.period !== "currentMonth" && _input.period !== "lastMonth" && _input.period !== "perPeriod") {
        generateOutput("Não foi informada uma opção válida. Ela deve ter ser \"Hoje\", \"Últimos 5 dias\", \"Últimos 10 dias\", \"Últimos 20 dias\", \"Mês atual\", \"Último mês\" ou \"Por período\"");
        return false;
    }
    if (_input.period === "perPeriod") {
        if (!_input.from) {
            generateOutput("Não foi informada a data de início do período!");
            return false;
        }
        if (!_input.until) {
            generateOutput("Não foi informada a data de término do período!");
            return false;
        }
    }
    return true;
}

// Valida a entrada sellers. Se ela existe, se é do tipo Array
function validateSellersInput() {
    if (!_input.sellers) {
        generateOutput("Não foram informados os vendedores!");
        return false;
    }
    if (!Array.isArray(_input.sellers)) {
        generateOutput("A entrada de vendedores não é do tipo array!");
        return false;
    }
    if (_input.sellers.length === 0) {
        generateOutput("A entrada de vendedores não possui nenhum vendedor!");
        return false;
    }
    return true;
}

// Valida a entrada de order e page
function validateOrderPage() {
    if(!_input.order){
        generateOutput("Não foi informado a ordem!");
        return false;
    }
    if(!setSort()){
        generateOutput("Ordem solicitada é inválida");
        return false;
    }
    if(!_input.page){
        generateOutput("Não foi informado a pagina!");
        return false;
    }
    if(_input.page < 1){
        generateOutput("Pagina inválida!");
        return false;
    }
    return true;
}

// Ordena e seleciona a pagina
function setSort(){
    if(_input.order === 'dateGrowing'){
        sortValue = "_creationDate.keyword";
        sortOrder = "asc";
        return true;
    }else if(_input.order === 'dateDescending'){
        sortValue = "_creationDate.keyword";
        sortOrder = "desc";
        return true;
    }else if(_input.order === 'prospectNameGrowing'){
        sortValue = "prospect.name.keyword";
        sortOrder = "asc";
        return true;
    }else if(_input.order === 'prospectNameDescending'){
        sortValue = "prospect.name.keyword";
        sortOrder = "desc";
        return true;
    }else if(_input.order === 'cpfCnpjGrowing'){
        sortValue = "cpfCnpj";
        sortOrder = "asc";
        return true;
    }else if(_input.order === 'cpfCnpjDescending'){
        sortValue = "cpfCnpj";
        sortOrder = "desc";
        return true;
    }else if(_input.order === 'salesChannelNameGrowing'){
        sortValue = "salesChannel.name.keyword";
        sortOrder = "asc";
        return true;
    }else if(_input.order === 'salesChannelNameDescending'){
        sortValue = "salesChannel.name.keyword";
        sortOrder = "desc";
        return true;
    }
    return false;
}

// Determina o range de acordo com o valor de _input.period
function getRange() {
    let range;
    
    if (_input.period === "today") {
        range = {
            "range": {
                "_creationDate": {
                    "time_zone": "-03:00", 
                    "gte": "now/d"
                }
            }
        };
    } else if (_input.period === "last5Days") {
        range = {
            "range": {
                "_creationDate": {
                    "time_zone": "-03:00",
                    "gte": "now-4d/d"
                }
            }
        };

    } else if (_input.period === "last10Days") {
        range = {
            "range": {
                "_creationDate": {
                    "time_zone": "-03:00",
                    "gte": "now-9d/d"
                }
            }
        };

    } else if (_input.period === "last20Days") {
        range = {
            "range": {
                "_creationDate": {
                    "time_zone": "-03:00",
                    "gte": "now-19d/d"
                }
            }
        };

    } else if (_input.period === "currentMonth") {
        range = {
            "range": {
                "_creationDate": {
                    "time_zone": "-03:00",
                    "gte": "now/M"
                }
            }
        };

    } else if (_input.period === "lastMonth") {
        range = {
            "range": {
                "_creationDate": {
                    "time_zone": "-03:00",
                    "lte": "now-1M/M",
                    "gte": "now-1M/M"
                }
            }
        };
    } else {
        range = {
            "range": {
                "_creationDate": {
                    "time_zone": "-03:00",
                    "gte": _input.from,
                    "lte": _input.until
                }
            }
        };
    }
    return range;
}

// Obtem a ordenação
function getOrder() {
    let order = [];
    
    switch (sortValue) {
        case "_creationDate.keyword" :
            order.push({"_creationDate.keyword" :{"order": sortOrder}});
            order.push({"_id" :{"order": sortOrder}});
            order.push({"prospect.name.keyword" :{"order": sortOrder}});
            order.push({"cpf.keyword" :{"order": sortOrder}});
            order.push({"cnpj.keyword" :{"order": sortOrder}});
            order.push({"salesChannel.name.keyword" :{"order": sortOrder}});
            order.push({"_processVersion.versionLabel.keyword" :{"order": sortOrder}});
            order.push({"_status._id" :{"order": sortOrder}});
            order.push({"saleStatus._id" :{"order": sortOrder}});
            order.push({"saleStatusBeforeCancelation._id" :{"order": sortOrder}});
            break;
        case "prospect.name.keyword" :
            order.push({"prospect.name.keyword" :{"order": sortOrder}});
            order.push({"_id" :{"order": sortOrder}});
            order.push({"cpf.keyword" :{"order": sortOrder}});
            order.push({"cnpj.keyword" :{"order": sortOrder}});
            order.push({"salesChannel.name.keyword" :{"order": sortOrder}});
            order.push({"_creationDate.keyword" :{"order": sortOrder}});
            order.push({"_processVersion.versionLabel.keyword" :{"order": sortOrder}});
            order.push({"_status._id" :{"order": sortOrder}});
            order.push({"saleStatus._id" :{"order": sortOrder}});
            order.push({"saleStatusBeforeCancelation._id" :{"order": sortOrder}});
            break;
        case "cpfCnpj" :
            order.push({"cpf.keyword" :{"order": sortOrder}});
            order.push({"cnpj.keyword" :{"order": sortOrder}});
            order.push({"_id" :{"order": sortOrder}});
            order.push({"salesChannel.name.keyword" :{"order": sortOrder}});
            order.push({"_creationDate.keyword" :{"order": sortOrder}});
            order.push({"prospect.name.keyword" :{"order": sortOrder}});
            order.push({"_processVersion.versionLabel.keyword" :{"order": sortOrder}});
            order.push({"_status._id" :{"order": sortOrder}});
            order.push({"saleStatus._id" :{"order": sortOrder}});
            order.push({"saleStatusBeforeCancelation._id" :{"order": sortOrder}});
            break;
        case "salesChannel.name.keyword" :
            order.push({"salesChannel.name.keyword" :{"order": sortOrder}});
            order.push({"_id" :{"order": sortOrder}});
            order.push({"_creationDate.keyword" :{"order": sortOrder}});
            order.push({"prospect.name.keyword" :{"order": sortOrder}});
            order.push({"cpf.keyword" :{"order": sortOrder}});
            order.push({"cnpj.keyword" :{"order": sortOrder}});
            order.push({"_processVersion.versionLabel.keyword" :{"order": sortOrder}});
            order.push({"_status._id" :{"order": sortOrder}});
            order.push({"saleStatus._id" :{"order": sortOrder}});
            order.push({"saleStatusBeforeCancelation._id" :{"order": sortOrder}});
            break;
        default:
    }
    return order;
}

// Obtem o retorno
function getReturn(sale) {
    let saleData = {};
    
    switch (sortValue) {
        case "_creationDate.keyword" :
            saleData = {
                "saleCreationDate": sale.sort[0] || "",
                "_id": sale.sort[1] || "",
                "prospectName": sale.sort[2] || "",
                "cpfCnpj": sale.sort[3] || sale.sort[4] || "",
                "currentSaleState": getSaleStatus(sale.sort[8], sale.sort[9], sale.sort[1], sale.sort[6]) || "",
                "salesChannelName": sale.sort[5] || "",
                "tagColor": getTagColor(sale.sort[8], sale.sort[7]) || ""
            };
            break;

        case "prospect.name.keyword" :
            saleData = {
                "prospectName": sale.sort[0] || "",
                "_id": sale.sort[1] || "",
                "cpfCnpj": sale.sort[2] || sale.sort[3] || "",
                "currentSaleState": getSaleStatus(sale.sort[8], sale.sort[9], sale.sort[1], sale.sort[6]) || "",
                "salesChannelName": sale.sort[4] || "",
                "saleCreationDate": sale.sort[5] || "",
                "tagColor": getTagColor(sale.sort[8], sale.sort[7]) || ""
            };
            break;
        case "cpfCnpj" :
            saleData = {
                "cpfCnpj": sale.sort[0] || sale.sort[1] || "",
                "_id": sale.sort[2] || "",
                "currentSaleState": getSaleStatus(sale.sort[8], sale.sort[9], sale.sort[2], sale.sort[6]) || "",
                "salesChannelName": sale.sort[3] || "",
                "saleCreationDate": sale.sort[4] || "",
                "prospectName": sale.sort[5] || "",
                "tagColor": getTagColor(sale.sort[8], sale.sort[7]) || ""
            };
            break;
        case "salesChannel.name.keyword" :
            saleData = {
                "salesChannelName": sale.sort[0] || "",
                "_id": sale.sort[1] || "",
                "saleCreationDate": sale.sort[2] || "",
                "prospectName": sale.sort[3] || "",
                "cpfCnpj": sale.sort[4] || sale.sort[5] || "",
                "currentSaleState": getSaleStatus(sale.sort[8], sale.sort[9], sale.sort[1], sale.sort[6]) || "",
                "tagColor": getTagColor(sale.sort[8], sale.sort[7]) || ""
            };
            break;
        default:
    }
    return saleData;
}

// Obtem os status da venda
function getSaleStatus(saleStatusId, saleStatusBeforeCancelationId, saleId, saleVersion) {
    if(saleStatusId === CANCELED_SALE_STATUS_ID || saleStatusId === CANCELED_FOR_IDLENESS_SALE_STATUS_ID || saleStatusId === CANCELING_FOR_IDLENESS_SALE_STATUS_ID) {
        if(saleStatusBeforeCancelationId) {
            return getLastStatus(saleStatusBeforeCancelationId);
        } else {
            return getSaleStatusOldVersions(saleId, saleVersion);
        }
    } else {
        return getLastStatus(saleStatusId);
    }
}

// Obtem a lista de status
function getLastStatus(saleStatusId) {
    let mainStatusesForStatus = {
        "5ee3aec2b42c2a6b6224489a": "5ee3aec2b42c2a6b6224489a",
        "5ee3b098b42c2a6b62244eba": "5ee3aec2b42c2a6b6224489a",
        "5fad7fbcaab7383fdaad61ba": "5ee3aec2b42c2a6b6224489a",
        "5f5bacab428dd638977039cf": "5ee3aec2b42c2a6b6224489a",
        "5eeb56d8e2a4942ab8321681": "5ee3aec2b42c2a6b6224489a",
        "610163d0dac85a2706a73f8b": "5ee3aec2b42c2a6b6224489a",
        "5f5bc337428dd6389777b188": "5ee3aec2b42c2a6b6224489a",
        "5fb2723eb90b5939d8017fda": "5ee3aec2b42c2a6b6224489a",
        "5f593894428dd6389745b0f3": "5ee3aec2b42c2a6b6224489a",
        "5e99b4f7abc8283d1effa39d": "5e99b4f7abc8283d1effa39d",
        "5ea34c99e2a4942ab81c01e8": "5e99b4f7abc8283d1effa39d",
        "601aaf9b642360144314946f": "601aaf9b642360144314946f",
        "5e99b51fabc8283d1effa3d5": "5e99b51fabc8283d1effa3d5",
        "5ea34cb0e2a4942ab81c0221": "5e99b51fabc8283d1effa3d5",
        "5ec54077e2a4942ab81fc8b0": "5ec54077e2a4942ab81fc8b0",
        "5e99b565abc8283d1effa450": "5e99b565abc8283d1effa450",
        "5f469ea60c072f674fe1ab4e": "5e99b565abc8283d1effa450",
        "600199bf6caa9e657cee97f6": "5e99b565abc8283d1effa450",
        "600966b11f58fc6e35309fb6": "5e99b565abc8283d1effa450",
        "5e99b684abc8283d1effaa39": "5e99b684abc8283d1effaa39",
        "5f2bf7eee2a4942ab88be95c": "5f2bf7eee2a4942ab88be95c",
        "5f1725144b139a14f3185ac4": "5f1725144b139a14f3185ac4",
        "5f2318b215f8700ea1a1a2b8": "5f1725144b139a14f3185ac4",
        "5e99b65babc8283d1effa9ea": "5f1725144b139a14f3185ac4",
        "5f49457b603d5c30450ccda1": "5f1725144b139a14f3185ac4",
        "5fb57352b3a60d685bab59c4":"5f1725144b139a14f3185ac4",
        "5ea34d67e2a4942ab81c100a": "5ea34d67e2a4942ab81c100a",
        "5e99e4baabc8283d1e00ac95": "5ea34d67e2a4942ab81c100a",
        "606324aed7182368ee6d7d6a": "606324aed7182368ee6d7d6a",
        "60632857d7182368ee6e17d8": "60632857d7182368ee6e17d8",
        "5ea6c554b42c2a6b6228bb8d": "5ea6c554b42c2a6b6228bb8d",
        "6050c85d62779372e9d136c5": "6050c85d62779372e9d136c5",
        "6050f4f36b0bee7c89c880b4": "6050c85d62779372e9d136c5",
        "5f638bd5428dd63897adcdf1": "5f638bd5428dd63897adcdf1",
        "600f010907f78a19ed729e86": "5f638bd5428dd63897adcdf1",
        "5e99c111abc8283d1effdb10": "5e99c111abc8283d1effdb10"
    };
    
    return br.com.sumicity.crmSales.saleStatus._get({"_id": mainStatusesForStatus[saleStatusId]}).name;
}

// Obtem os status da venda para versões antigas
function getSaleStatusOldVersions(saleId, versionLabel) {
    let processVersion = "v" + (versionLabel).replace(".", "_");
    let processInstance = eval("_process.venda." + processVersion);
    let treeSale = processInstance._getTree({"_id": saleId});
    let lastStatus = getLastStatusOldVersions(treeSale);

    return getLastStatus(lastStatus);
}

// Obtem o último status principal que a venda passou
function getLastStatusOldVersions(treeSale) {
    const mainStatusesByTasks = {
        "scriptTask5f6361e4da9aa26b7a000001": "5f638bd5428dd63897adcdf1",
        "scriptTask6050c449c3b0b54176000001": "6050c85d62779372e9d136c5",
        "scriptTask6061bfcdb0a14e3fb5000008": "5ea6c554b42c2a6b6228bb8d",
        "scriptTask6061bfadb0a14e3fb5000007": "60632857d7182368ee6e17d8",
        "createContractAndConcludeSale": "606324aed7182368ee6d7d6a",
        "installationEvent": "5ea34d67e2a4942ab81c100a",
        "scriptTaskCreateAirContract": "5f1725144b139a14f3185ac4",
        "userTask5ebad280419fe868a3000001": "5f2bf7eee2a4942ab88be95c",
        "vendaFinalizarCadastro": "5e99b684abc8283d1effaa39",
        "eventProductSelection": "5e99b565abc8283d1effa450",
        "userTask5f2aba1b684f565b87000001": "5ec54077e2a4942ab81fc8b0",
        "financeViabilityTask": "5e99b51fabc8283d1effa3d5",
        "userTaskCompleteRegistration": "601aaf9b642360144314946f",
        "technicalViabilityTask": "5e99b4f7abc8283d1effa39d",
        "eventAddressRegister": "5ee3aec2b42c2a6b6224489a",
    };
    let taskIdentifiers = Object.keys(mainStatusesByTasks);
    let findLastStatus = false;
    let lastStatus;
    taskTree = [];
    
    if (treeSale.tree) {
        fillTaskTree(treeSale.tree.nexts);
        taskTree.sort(function(a, b) {
            return b.lastUpdateDate - a.lastUpdateDate;
        });
        taskTree.forEach(task => {
            if(!findLastStatus && taskIdentifiers.some(taskIdentifier => taskIdentifier === task.identifier)) {
                lastStatus = task.identifier;
                findLastStatus = true;
            }
        });
    }
    return mainStatusesByTasks[lastStatus];
}

// Preenche a árvore de tarefas com os identificadores e data da ultima alteração das tarefas 
function fillTaskTree(nexts) {
    if(nexts.length) {
        nexts.forEach(next => {
            taskTree.push({
                "identifier": next.identifier,
                "lastUpdateDate": new Date(next.lastUpdateDate)
            });
            if (next.nexts.length) {
                fillTaskTree(next.nexts);
            }
        });
    }
}

// Obtem a cor da tag de status do processo
function getTagColor(saleStatusId, processStatusId) {
    if(saleStatusId === FINISHED_SALE_STATUS_ID) {
        return "#20770A";
    } else if(processStatusId === FINISHED_STATUS_ID) {
        return "#C77700";
    } else {
        return "#0A5077";
    }
}

// Obtém todos os status a serem filtrados a partir do status principais selecionados
function getStatusFilters(idSelectedStatuses){

    let allStatusesSearched = [];
    
    const saleStatus = {
        "5ee3aec2b42c2a6b6224489a": ["5ee3aec2b42c2a6b6224489a","5ee3b098b42c2a6b62244eba", "5fad7fbcaab7383fdaad61ba", "5f5bacab428dd638977039cf", "5eeb56d8e2a4942ab8321681", "610163d0dac85a2706a73f8b", "5f5bc337428dd6389777b188", "5fb2723eb90b5939d8017fda","5f593894428dd6389745b0f3"],
        "5e99b4f7abc8283d1effa39d": ["5e99b4f7abc8283d1effa39d", "5ea34c99e2a4942ab81c01e8"],
        "601aaf9b642360144314946f": ["601aaf9b642360144314946f"],
        "5e99b51fabc8283d1effa3d5": ["5e99b51fabc8283d1effa3d5", "5ea34cb0e2a4942ab81c0221"],
        "5ec54077e2a4942ab81fc8b0": ["5ec54077e2a4942ab81fc8b0"],
        "5e99b565abc8283d1effa450": ["5e99b565abc8283d1effa450", "5f469ea60c072f674fe1ab4e", "600199bf6caa9e657cee97f6", "600966b11f58fc6e35309fb6"],
        "5e99b684abc8283d1effaa39": ["5e99b684abc8283d1effaa39"],
        "5f2bf7eee2a4942ab88be95c": ["5f2bf7eee2a4942ab88be95c"],
        "5f1725144b139a14f3185ac4": ["5f1725144b139a14f3185ac4", "5f2318b215f8700ea1a1a2b8", "5e99b65babc8283d1effa9ea", "5f49457b603d5c30450ccda1", "5fb57352b3a60d685bab59c4"],
        "5ea34d67e2a4942ab81c100a": ["5ea34d67e2a4942ab81c100a","5e99e4baabc8283d1e00ac95"],
        "606324aed7182368ee6d7d6a": ["606324aed7182368ee6d7d6a"],
        "60632857d7182368ee6e17d8": ["60632857d7182368ee6e17d8"],
        "5ea6c554b42c2a6b6228bb8d": ["5ea6c554b42c2a6b6228bb8d"],
        "6050c85d62779372e9d136c5": ["6050c85d62779372e9d136c5", "6050f4f36b0bee7c89c880b4"],
        "5f638bd5428dd63897adcdf1": ["5f638bd5428dd63897adcdf1", "600f010907f78a19ed729e86"],
        "5e99c111abc8283d1effdb10": ["5e99c111abc8283d1effdb10"]
    };
    
    idSelectedStatuses.forEach(idSelectedStatus =>{
        if(Array.isArray(saleStatus[idSelectedStatus])){
            saleStatus[idSelectedStatus].forEach(saleStatusId=>{
                allStatusesSearched.push(saleStatusId);
            });
        }
    });
    
    return allStatusesSearched;
    
}