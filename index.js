const express = require('express')
const { query } = require('gamedig')
const { writeFileSync, readFileSync } = require('fs')
const { hostInfos } = require('./config')
const cors = require('cors')


const app = express()
app.use(cors())

app.get('/servers/:id', (request, response) => {
  const serversJSON = JSON.parse(readFileSync('./servers.json', { encoding: 'utf8' }))

  let server = serversJSON.servers.find(sv => sv.name === request.params.id)

  if (!server) return response.status(404).json({ error: 'Server not found' })

  if (server.redirectTo !== '') return response.status(200).json({ redirectTo: server.redirectTo })

  const servers = []

  for (let i in serversJSON.servers) {
    if (serversJSON.servers[i].name === request.params.id) continue;

    if (serversJSON.servers[i].redirectTo === '') {
      if (serversJSON.servers[i].serversInfos[0].players < (serversJSON.servers[i].serversInfos[0].playersTotal - 1)) {
        servers.push(serversJSON.servers[i].serversInfos[0])
      }
    } else {
      servers.push(serversJSON.servers[i].serversInfos.find(sv => sv.ip === serversJSON.servers[i].redirectTo))
    }
  }


  return response.status(200).json({ redirectTo: '', servers: servers.map(sv => `${sv.name.slice(0, sv.name.indexOf('|')).trimEnd()}&${sv.ip}`).join('|'), serverCount: servers.length })
})
app.get('/servers', async (request, response) => {
  const serversJSON = JSON.parse(readFileSync('./servers.json', { encoding: 'utf8' }))

  if (new Date().getTime() - serversJSON.lastSync <= '60000') {
    serversJSON.servers.map(m => m.serversInfos = m.serversInfos.map(sv => {
      sv.ip.startsWith('172') ? sv.ip = sv.ip.replace('172.16.0.30', 'conectar2.savageservidores.com') : sv.ip = sv.ip.replace('131.196.196.197', 'conectar.savageservidores.com')
      return sv
    }))
    return response.status(200).json(serversJSON.servers)
  }

  let servers = []

  for (let serverPort of hostInfos) {

    await query({
      type: 'csgo',
      host: serverPort.host,
      port: serverPort.port,
    })
      .then((state) => {
        let findSv = servers.find(sv => sv.name === serverPort.name)

        findSv ?
          findSv.serversInfos.push({
            name: state.name,
            map: state.map,
            ip: `${serverPort.host}:${serverPort.port}`,
            players: state.raw.numplayers,
            playersTotal: state.maxplayers
          })
          :
          servers.push({
            name: serverPort.name,
            redirectTo: '',
            serversInfos: [
              {
                name: state.name,
                map: state.map,
                ip: `${serverPort.host}:${serverPort.port}`,
                players: state.raw.numplayers,
                playersTotal: state.maxplayers
              }
            ],
          })
      })
      .catch((err) => { })
  }
  servers = servers.map(sv => {
    if (sv.serversInfos.length <= 1) return sv;

    let newSv = []

    for (let i in sv.serversInfos) {
      newSv.push((sv.serversInfos[i].players / sv.serversInfos[i].playersTotal).toFixed(2))
    }

    let getServers = newSv.reduce(function (prev, curr) {
      return (Math.abs(curr - 0.5) < Math.abs(prev - 0.5) ? curr : prev);
    })
    getServers = sv.serversInfos[newSv.findIndex(m => m === getServers)].ip
    getServers ? sv.redirectTo = getServers : sv.redirectTo = sv.serversInfos[0].ip
    return sv
  })

  serversJSON.lastSync = new Date().getTime()
  serversJSON.servers = servers

  writeFileSync('./servers.json', JSON.stringify(serversJSON))

  serversJSON.servers.map(svs => {
    svs.serversInfos = svs.serversInfos.map(sv => {
      if (sv.ip.startsWith('172')) {
        sv.ip = sv.ip.replace('172.16.0.30', 'conectar2.savageservidores.com')
        return sv
      } else {
        sv.ip = sv.ip.replace('131.196.196.197', 'conectar.savageservidores.com')
        return sv
      }
    })
    return svs
  })

  return response.status(200).json(serversJSON.servers)
})

app.listen(22500, () => console.log('Servidor rodando na porta 22500'))