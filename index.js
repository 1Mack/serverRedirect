const express = require('express')
const config = require('./config.json')
const { query } = require('gamedig')
const app = express()
const { writeFileSync } = require('fs')


app.get('/servers/:id', (request, response) => {
  let server = config[request.params.id]

  if (!server) return response.status(404).json('Server not found')

  if (new Date().getTime() - server.lastSync <= '60000') return response.json(server.servers)

  async function GetServers() {
    const servers = []
    for (let serverPort of server.ports) {

      await query({
        type: 'csgo',
        host: '131.196.196.197',
        port: serverPort,
        maxAttempts: 7,
      })
        .then((state) => {

          servers.push({
            players: state.raw.numplayers,
            ip: state.connect
          })
        })
        .catch(() => { })
    }

    return servers.reduce((min, cur) => min.players < cur.players ? min : cur)
  }
  GetServers().then((sv) => {
    server.lastSync = new Date().getTime()
    server.servers = sv
    config[request.params.id] = server
    writeFileSync('./config.json', JSON.stringify(config))
    return response.json(sv)
  })
})

app.listen(3333, () => console.log('Servidor rodando na porta 3333'))