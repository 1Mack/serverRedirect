const express = require('express')
const serversJSON = require('./servers.json')
const { query } = require('gamedig')
const app = express()
const { writeFileSync } = require('fs')
const { hostInfos } = require('./config')

app.get('/servers/:id', (request, response) => {
  
  let server = serversJSON.servers.find(sv => sv.name === request.params.id)

  if (!server) return response.status(404).json('Server not found')

  //if (new Date().getTime() - serversJSON.lastSync <= '60000') return response.json(server)
  
  return response.json(server.redirectTo) 
})
app.get('/servers', async (request, response) => {

  if (new Date().getTime() - serversJSON.lastSync <= '60000') return response.json(serversJSON.servers)

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
            ip: state.connect,
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
                ip: state.connect,
                players: state.raw.numplayers,
                playersTotal: state.maxplayers
              }
            ],
          })
      })
      .catch((err) => { console.log(err) })
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

  response.json(serversJSON)
  return writeFileSync('./servers.json', JSON.stringify(serversJSON))
})

app.listen(3333, () => console.log('Servidor rodando na porta 3333'))