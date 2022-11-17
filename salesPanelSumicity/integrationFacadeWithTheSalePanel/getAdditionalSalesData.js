/*
* O método permite obter os dados adicionais da venda para o painel de monitoramento de vendas.
*
* @input
* { 
*   saleId: (string) - Id da venda (Obrigatório)
* }
* 
* @output para Erro:
*   _output: {
*       status: 400
*       message: Motivo_do_erro
* }
* 
* @output para Sucesso:
*    _output: {
*       status: 200,
*       message: "Sucesso",
*       saleData: {
*           prospectName: (string) - Nome do prospecto/cliente,
*           cpfCnpj: (number) - CPF ou CNPJ do prospecto/cliente, 
*           salesChannelName: (string) - Nome do canal de venda,
*           seller: (string) - Nome do vendedor,
*           saleCreationDate: (date ISOString) - Data de criação da venda,
*           dateOfLastSaleChange: (date ISOString) - Data da última alteração da venda,
*           saleId: (string) - Id da venda,
*           currentSaleState: (string) - Nome do status atual da venda,
*           airContractCode: (string) - Código da contrato no AIR,
*           saleStatus:  (array) - Array com o nome dos status principais pelos quais a venda passou,
*           reason: (string) -> Motivo do insucesso do processo de venda,
*           installationAddress: { 
*               city: (string) - Cidade do endereço de instalação na venda,
*               zipcode: (string) - CEP do endereço de instalação na venda,
*               street:  (string) - Logradouro do endereço de instalação na venda,
*               quarter: (string) - Bairro do endereço de instalação na venda,
*               number:  (string) - Número do endereço de instalação na venda,
*               complement: (string) - Complemento do endereço de instalação na venda.
*           },
*           planOffer: (String) - Plano/Oferta.
*           airData:{
*               num_chamado: (string) - Código do chamado no Air,
*               data_instalacao: (string) - Data de instalação,
*               fila: (string) - Fila dado da venda no Air,
*               motivo_os: (string) - Motivo da Ordem de serviço
*           }
*       }
*   }
*/

const CANCELED_SALE_STATUS_ID = "5ea34de6e2a4942ab81c110f";
const CANCELED_FOR_IDLENESS_SALE_STATUS_ID = "609d12f421926828cd18220c";
const CANCELING_FOR_IDLENESS_SALE_STATUS_ID = "602e7810dada4448608fe64b";
const FINISHED_SALE_STATUS_ID = "5e99c111abc8283d1effdb10";
const FINISHED_STATUS_ID = "595c20500190000000000002";
let taskTree = [];
let saleData;

if (validateInput()) {
    let sale = getSale();
    getSaleDate(sale);
    generateOutput();
}

//-------------------Funções Principais-------------------

// Valida as entradas
function validateInput() {
    if (!_input) {
        generateOutput("Não há dados de entrada!");
        return false;
    } else if (!_input.saleId) {
        generateOutput("Não foi informado o id da venda!");
        return false;
    }
    return true;
}

// Obtem a venda
function getSale() {
    let result = _process.venda.current._search({
        "query": {
            "term": {
                "_id": _input.saleId
            }
        },
        "size": 1
    }).hits;
    return result;
}

// Obtem os dados da venda
function getSaleDate(sale) {
    if (sale.hits.length > 0) {
        let source = sale.hits[0]._source;
        let address = source.installationAddressProcess;
        let statusList = getSaleStatus(source) || "";
        saleData = {
            "prospectName": (source.prospect && source.prospect.name) ? source.prospect.name : "",
            "cpfCnpj": (source.cnpj || source.cpf) ? source.cnpj || source.cpf : "",
            "salesChannelName": (source.salesChannel && source.salesChannel.name) ? source.salesChannel.name : "",
            "seller": source.responsibleForSale ? getSellerName(source.responsibleForSale) : "",
            "saleCreationDate": source._creationDate ? source._creationDate : "",
            "dateOfLastSaleChange": source._lastUpdateDate ? source._lastUpdateDate : "",
            "saleId": source._id,
            "currentSaleState": statusList.length ? statusList[statusList.length - 1] : "",
            "airContractCode": source.airContractCode ? source.airContractCode : "",
            "saleStatus": statusList,
            "reason": (source.saleStatus && source.saleStatus._id) ? concatenateMessage(getReason(source)) : "",
            "hasFailed": (source.saleStatus && source._status && source.saleStatus._id && source._status._id) ? hasFailed(source.saleStatus._id, source._status._id) : "",
            "installationAddress": source.installationAddressProcess ? {
                "city": address.city ? address.city : "",
                "zipcode": address.zipcode ? address.zipcode : "",
                "street": address.street ? address.street : "",
                "quarter": address.quarter ? address.quarter : "",
                "number": address.number ? address.number : "",
                "complement": address.complement ? address.complement : ""
            } : "",
            "airData": source.airTicketCode ? getAirData(source._id, source.airTicketCode) : {},
            "planOffer": getPlanOffer(source)
        };
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
            "saleData": saleData
        };
    }
}

//-------------------Funções Auxiliares-----------------------

// Retorna o motivo do insucesso
function getReason(sale) {
    switch (sale.saleStatus._id) {

        case "5ea34de6e2a4942ab81c110f":
            return sale.saleStatusBeforeCancelation ? "Processo cancelado manualmente na etapa \"" + sale.saleStatusBeforeCancelation.name + "\"." : "Processo cancelado manualmente.";

        case "5eeb56d8e2a4942ab8321681":
            return "Condomínio não liberado para venda.";

        case "610163d0dac85a2706a73f8b":
            return "Bloco do condomínio não liberado para venda.";

        case "5f5bc337428dd6389777b188":
            return "Condomínio com restrições quanto a venda e não liberado pelo Back Office.";

        case "5fb2723eb90b5939d8017fda":
            return "Endereço já possuí cliente ou possui restrições quanto a venda e não foi liberado pelo Back Office.";

        case "5f593894428dd6389745b0f3":
            return "Endereço não encontrado e não liberado pela Engenharia.";

        case "5ea34c99e2a4942ab81c01e8":
            return sale.reasonAutomaticNonApprovalTechnicalAnalysis ? sale.reasonAutomaticNonApprovalTechnicalAnalysis : "Endereço sem viabilidade técnica.";

        case "5ea34cb0e2a4942ab81c0221":
            return sale.rulesNotMetFinancialAnalysis ? sale.rulesNotMetFinancialAnalysis : "Cliente sem viabilidade financeira.";

        case "600966b11f58fc6e35309fb6":
            return "Cliente não aceitou o pagamento de instalação antecipada.";

        case "5f49457b603d5c30450ccda1":
            return "Pagamento de instalação antecipada não realizada até o prazo de 5 dias após o vencimento.";

        case "5e99e4baabc8283d1e00ac95":
            return "A instalação não pode ser realizada.";

        case "5fb57352b3a60d685bab59c4":
            return "Cliente reprovado pelo Qualify por não atender as regras de restriçaõ financeira.";

        case "609d12f421926828cd18220c":
            return sale.saleStatusBeforeCancelation ? "Processo cancelado por ociosidade na etapa \"" + sale.saleStatusBeforeCancelation.name + "\"." : "Processo cancelado por ociosidade.";

        default:
            return "";
    }
}

// Concatena as mensagens
function concatenateMessage(message) {
    if (message.length >= 1 && typeof message !== 'string') {
        let result = "";
        message.forEach((elem) => {
            result += elem + ". ";
        });
        result = result.substring(0, result.length - 1);
        return result;
    } else {
        return message;
    }
}

// Obtem os status da venda
function getSaleStatus(sale) {
    if (sale.saleStatus._id === CANCELED_SALE_STATUS_ID || sale.saleStatus._id === CANCELED_FOR_IDLENESS_SALE_STATUS_ID || sale.saleStatus._id === CANCELING_FOR_IDLENESS_SALE_STATUS_ID) {
        if (sale.saleStatusBeforeCancelation) {
            return getStatusList(sale.saleStatusBeforeCancelation._id);
        } else {
            return getSaleStatusOldVersions(sale);
        }
    } else {
        return getStatusList(sale.saleStatus._id);
    }
}

// Obtem a lista de status
function getStatusList(saleStatusId) {
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
        "5fb57352b3a60d685bab59c4": "5f1725144b139a14f3185ac4",
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
    let mainStatusesForStatusKeys = Object.keys(mainStatusesForStatus).reverse();
    let findLastStatus = false;
    let statusList = [];
    let statusName;

    mainStatusesForStatusKeys.forEach(key => {
        if (key === saleStatusId) {
            findLastStatus = true;
        }
        if (findLastStatus) {
            statusName = br.com.sumicity.crmSales.saleStatus._get({ "_id": mainStatusesForStatus[key] }).name;
            if (!statusList.some(status => status === statusName)) {
                statusList.push(statusName);
            }
        }
    });
    return statusList.reverse();
}

// Obtem os status da venda para versões antigas
function getSaleStatusOldVersions(sale) {
    let processVersion = "v" + (sale._processVersion.versionLabel).replace(".", "_");
    let processInstance = eval("_process.venda." + processVersion);
    let treeSale = processInstance._getTree({ "_id": sale._id });
    let lastStatus = getLastStatus(treeSale);
    let statusList = getStatusList(lastStatus);

    return statusList;
}

// Obtem o último status principal que a venda passou
function getLastStatus(treeSale) {
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

    if (treeSale.tree) {
        fillTaskTree(treeSale.tree.nexts);
        taskTree.sort(function (a, b) {
            return b.lastUpdateDate - a.lastUpdateDate;
        });
        taskTree.forEach(task => {
            if (!findLastStatus && taskIdentifiers.some(taskIdentifier => taskIdentifier === task.identifier)) {
                lastStatus = task.identifier;
                findLastStatus = true;
            }
        });
    }
    return mainStatusesByTasks[lastStatus];
}

// Preenche a árvore de tarefas com os identificadores e data da ultima alteração das tarefas 
function fillTaskTree(nexts) {
    if (nexts.length) {
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

// Verifica se o processo teve insucesso
function hasFailed(saleStatusId, processStatusId) {
    if (processStatusId === FINISHED_STATUS_ID && saleStatusId !== FINISHED_SALE_STATUS_ID) {
        return true;
    } else {
        return false;
    }
}

// Retorna os dados de instalação do Air na Venda 
function getAirData(saleId, airTicketCode) {
    let input = {
        "payload": {
            "codigoChamadoAir": airTicketCode
        },
        "objects": saleId
    }

    let result = br.com.sumicity.externalIntegrationFacadeCrmSale.getSalesInstallationDataAir(input).result;
    
    if (result.success && result.response) {
        return {
            "num_chamado": result.response.num_chamado || "",
            "data_instalacao": result.response.data_instalacao || "",
            "fila": result.response.fila || "",
            "motivo_os": result.response.motivo_os || ""
        }
    } else {
        return {};
    }
}

// Retorna nome do vendedor concatenado com empresa
function getSellerName(seller){
    let name = "";
    if(seller && seller.user && seller.user.name){
        name = seller.user.name;
        if(seller.outsourcedCompanie && seller.outsourcedCompanie.name){
            name += (" / " + seller.outsourcedCompanie.name);
        } else {
            name += " / Sumicity";
        }
    }
    return name;
}

// Retorna plan/ofer
function getPlanOffer(sale) {
    let planOffer = "";
    if(sale.customizedContractPlan && sale.customizedContractPlan.name) {
        planOffer += sale.customizedContractPlan.name;
        if(sale.offer && sale.offer.name) {
            planOffer += " / ";
        }
    }
    if( sale.offer && sale.offer.name) {
        planOffer += sale.offer.name;
    }
    return planOffer;
}