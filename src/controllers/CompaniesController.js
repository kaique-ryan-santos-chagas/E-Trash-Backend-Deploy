const connection = require('../database/connection');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');

function hash(password){
    const saltRounds = 12;
    const salt = bcrypt.genSaltSync(saltRounds);
    const hash = bcrypt.hashSync(password, salt);
    return hash;
}

function generateToken(params = {}){
	return jwt.sign(params, authConfig.secret,{
		expiresIn:86400,
	});
}

module.exports = {
   async index(request, response){
        const companies = await connection('companies')
        .select('id', 
                'name', 
                'email',
                'activity',
                'collector', 
                'country', 
                'city', 
                'region', 
                'neightborhood',
                'phone',
                'latitude', 
                'longitude');

        const [count] = await connection('companies').count();

        response.header('Total-Companies-Count', count['count']);
        
        const companiesAvatarsKey = await connection('uploads').select('key');
        const companiesAvatars = companiesAvatarsKey.map(function(item){
            const avatar = path.resolve(`../../temp/uploads/companies/${item}`);
            return avatar;
        }); 
        return response.json({companies, avatar: companiesAvatars});
    },

    async create(request, response){
        const { 
              cnpj, 
              passwordInput, 
              collector,
              country,
              city,
              region,
              latitude,
              longitude } = request.body;

        const id = crypto.randomBytes(5).toString("HEX");
        const password = hash(passwordInput);
        const dataCNPJ = await axios.get(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`);
        
        if (dataCNPJ.data.status == "ERROR") {
            return response.status(400).json({error: dataCNPJ.data.message});
        }

        const name = dataCNPJ.data.nome;
        const email = dataCNPJ.data.email;
        const activity = dataCNPJ.data.atividade_principal[0].text;
        const phone = dataCNPJ.data.telefone;
        const neightborhood = dataCNPJ.data.bairro;
        
        await connection('companies').insert({
            id,
            cnpj,
            name,
            email,
            password,
            activity,
            collector,
            country,
            city,
            region,
            neightborhood,
            phone,
            latitude, 
            longitude
        });

        return response.json({
            sucess: "Companhia cadastrada com sucesso",
            id: id,
            token: generateToken({id: id})
        });
    
    },
    
    async delete(request, response){
        const companyId = req.headers.identification;
        const { passwordInput } = request.body;

        const companyIdBD = await connection('companies').where('id', companyId)
        .select('id').first();

        if(!companyIdBD){
            return response.status(401).json({error: 'Operação não permitida'});
        }

        const passwordDB = await connection('companies').where('id', companyIdBD.id)
        .select('password').first();

        const companyMatch = bcrypt.compareSync(passwordInput, passwordDB.password);
        
        if (!companyMatch) {
            return response.status(401).json({error: 'Senha Inválida'});
        }

        const oldCompanyKey = await connection('uploads').where('company_id',companyId)
        .select('key').first();

        fs.unlink(`./temp/uploads/companies/${oldCompanyKey.key}`, function(err){
			if(err) throw err
			res.status(400).json("Imagem de perfil inexistente!");
        });
        
        await connection('uploads').where('company_id', companyIdBD.id).delete();
        await connection('schedule').where('company_id', companyIdBD.id).delete();
        await connection('schedule').where('company_collector_id', companyIdBD.id).delete();
        await connection('companies').where('id', companyIdBD.id).delete();
        return response.send();
    },
    
    async upload(request, response){
        const companyId = request.headers.identification;
        const companyIDDB = await connection('companies').where('id', companyId)
        .select('id').first();

        if (!companyIDDB) {
            return res.status(400).json({error: 'Empresa não encontrado.'})
        }
        
        const id = crypto.randomBytes(5).toString('HEX');
        const company_id = userIDDB.id;
        const imgName = req.file.originalname;
        const size = req.file.size;
        const key = req.file.filename;
        await connection('uploads').insert({
            id,
            imgName,
            size,
            key,
            company_id
        }); 
        return response.json({sucess:"Imagem carregada com sucesso!" });
    
    },

    async scheduling(request, response){
        const company_id = request.headers.identification;
        const { nameCollector, date } = request.body;
        const companyDB = await connection('companies').where('id', company_id)
        .select('id').first();

        const idCollector = await connection('companies').where('name', nameCollector)
        .select('id').first();

        if (!companyDB) {
            return response.status(400).json({error: 'Empresa não encontrada'});
        }

        if (!idCollector) {
            return response.status(400).json({error: 'Empresa não encontrada'});
        }

        const company_collector_id = idCollector.id;
        const dateNow = Date();
        const date_scheduling = dateNow.toString();
        const date_collect = date;
        await connection('schedule').insert({
            company_id,
            company_collector_id,
            date_scheduling,
            date_collect
        });

        return response.json({sucess: 'Coleta Solicitada'});
    },

    async schedule(request, response){
        const company_id = request.headers.identification;
        const idCompanyDB = await connection('companies').where('id', company_id)
        .select('id').first();

        if (!idCompanyDB) {
            return response.status(400).json({error: 'Empresa não encontrada'});
        }

        const collector = await connection('companies').where('id', idCompanyDB.id)
        .select('collector').first();

        if (collector.collector != true) {
            return response.status(400).json({error: 'Sua empresa não faz coleta de descartes eletrônicos'});
        }

        const solicitations = await connection('schedule').where('company_collector_id', idCompanyDB.id)
        .select('*');

        if (solicitations[0] == null) {
            return response.json({message: 'Nenhuma solicitação de descarte encontrada'});
        }

        const companySolicitation = await connection('companies')
        .join('schedule', 'schedule.company_id', '=', 'companies.id')
        .select('cnpj','name', 'email', 'discarts', 'activity', 'country', 'city', 'region', 'neightborhood', 'phone', 'latitude', 'longitude');

        return response.json({solicitations, companySolicitation});
    }
        
};
    