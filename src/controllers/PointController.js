const connection = require('../database/connection');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth');
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
    index: async (request, response) => {
        const companies = await connection('discarts_points').select('name','rua','numero','numero','discarts','country','city','region');
        const [count] = await connection('companies').count();

        const pointsAvatarsKey = await connection('uploads').select('key');
        const pointsAvatars = companiesAvatarsKey.map(function(item){
            const avatar = path.resolve(`../../temp/uploads/points/${item}`);
            return avatar;
        }); 
        response.header('Total-Companies-Count',count['count']);
        return response.json({points, avatar: pointsAvatars});
    },
   	
   	create: async (request, response) => {
        const {name, 
              passwordInput, 
              discarts, 
              rua, 
              numero,
              country,
              city,
              region,
              latitude,
              longitude } = request.body;

        const password = hash(passwordInput);
        const id = crypto.randomBytes(5).toString("HEX");

        await connection('discarts_points').insert({
            id,
            name,
            password,
            discarts,
            rua,
            numero,
            country,
            city,
            region,
            latitude,
            longitude
        });
        
        return response.json({
            sucess: "Ponto registrado com sucesso!",
            id: id,
            token: generateToken({id: id})
        });

    },
    
    delete: async (request, response) => {
        const point_id = request.headers.authorization;
        const { passwordInput } = request.body;
        const idSearch = await connection('discarts_points').where('id', point_id).select('id')
        .first();
        
        if(!idSearch){
            return response.status(401).json({error: "Você não tem permissão para deletar este ponto!"});
        }

        const passwordDB = await connection('discarts_points').where('id', point_id)
        .select('password').first();
        const passwordMatch = await bcrypt.compareSync(passwordInput, passwordDB.password);

        if(!passwordMatch){
        	return response.status(400).json({error: 'Senha inválida'});
        }

        const oldPointKey = await connection('uploads').where('point_id',point_id).select('key')
        .first();

        fs.unlink(`./temp/uploads/companies/${oldPointKey.key}`, function(err){
			if(err)throw err
			res.status(400).json("Imagem de perfil inexistente!");
		});
        
        await connection('discarts_points').where('id', point_id).delete();
        return response.json('Ponto deletado com sucesso!');
    },
    
    upload: async(request, response) => {
        const pointId = request.headers.identification;
        const pointIDDB = await connection('discarts_points').where('id', pointId)
        .select('id').first();

        if (!pointIDDB) {
            return res.status(400).json({error: 'Ponto de coleta não encontrado.'})
        }
        
        const id = crypto.randomBytes(5).toString('HEX');
        const point_id = userIDDB.id;
        const imgName = req.file.originalname;
        const size = req.file.size;
        const key = req.file.filename;
        await connection('uploads').insert({
            id,
            imgName,
            size,
            key,
            point_id
        }); 
        return response.json({sucess:"Imagem carregada com sucesso!" });
    
    }

}    
