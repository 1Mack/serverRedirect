const express = require('express')
const serversJSON = require('./servers.json')
const { query } = require('gamedig')
const { writeFileSync } = require('fs')
const { hostInfos } = require('./config')
const cors = require('cors')


const app = express()
app.use(cors())

app.get('/servers/:id', (request, response) => {

  let server = serversJSON.servers.find(sv => sv.name === request.params.id)

  if (!server) return response.status(404).json({ error: 'Server not found' })

  if (server.redirectTo !== '') return response.status(200).json({ redirectTo: server.redirectTo })


  const serversFilter = serversJSON.servers.filter(sv => sv.name !== request.params.id).map((server) => {
    if (server.redirectTo === '') {
      if (server.serversInfos[0].players < (server.serversInfos[0].playersTotal - 1))
        return `${server.serversInfos[0].name.slice(0, server.serversInfos[0].name.indexOf('|')).trimEnd()}/${server.serversInfos[0].ip}`
    } else {
      let serverFind = server.serversInfos.find(sv => sv.ip === server.redirectTo)
      return `${serverFind.name.slice(0, serverFind.name.indexOf('|')).trimEnd()}/${server.redirectTo}`
    }
  })

  return response.status(200).json({ redirectTo: '', servers: serversFilter.join('|'), serverCount: serversFilter.length })
})
app.get('/servers', async (request, response) => {

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