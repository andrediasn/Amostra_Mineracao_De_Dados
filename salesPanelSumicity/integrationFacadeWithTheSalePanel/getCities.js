/*
*  Obtém cidades contidas nas regionais
*
*  @input
*  {
*       "regionalId": [id_da_regional_1, _id: id_da_regional_2, _id: id_da_regional_3] (Opcional)
*  }
*
*  @output para Erro:
*  {
*       "status": 400 (para reprovado), 
*       "message": Motivo_do_erro
*  }
*
*  @output para sucesso 
*  {
*       "status": 200
*       "message": "Sucesso" 
*       "cities": [{_id: id_da_cidade_1, name: nome_da_cidade_1}, {_id: id_da_cidade_2, name: nome_da_cidade_2}, {_id: id_da_cidade_3, name: nome_da_cidade_3}]
*  }
*
*/

let cities = [];

if (validateInput()) {
    getCitiesFromRegional();
    generateOutput();
}

//-------------------Funções Principais-------------------

// Valida as entradas
function validateInput() {
    if (!_input) {
        generateOutput("Não há dados de entrada!");
        return false;
    } else if (_input.regionalId && !Array.isArray(_input.regionalId)) {
        generateOutput("A entrada de regionais não é do tipo array!");
        return false;
    }
    return true;
}

//Obtém as cidades de todas regionais ou das informadas
function getCitiesFromRegional() {
    let query = { "size": 30 };

    if (_input.regionalId && _input.regionalId.length > 0) {
        query.query = {
            "terms": {
                "_id": _input.regionalId
            }
        };
    }
    let resultSearch = br.com.sumicity.regional._search(query).hits;

    if (resultSearch.total > 0) {
        resultSearch.hits.forEach(regional => {
            regional._source.cities.forEach(city => {
                cities.push({
                    _id: city._id,
                    name: city.name
                });
            });
        });
        
        cities.sort((a, b) => {
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        });
        
        cities = cities.filter(function (a) {
	        return !this[_utils.stringifyAsJson(a)] && (this[_utils.stringifyAsJson(a)] = true);
        }, Object.create(null));
    }

}

// Gera output de sucesso ou erro
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
            "cities": cities,
        };
    }
}