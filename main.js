const { resolve, basename } = require('path');
const { app, Menu, Tray, dialog } = require('electron');

const { spawn, exec } = require('child_process');
const fixPath = require('fix-path');
const fs = require('fs');
const NodePdfPrinter = require('node-pdf-printer');
const Store = require('electron-store');

fixPath();

const schema = {
  projects: {
    type: 'string',
  },
};

let mainTray = {};

if (app.dock) {
  app.dock.hide();
}

const store = new Store({ schema });
function render(tray = mainTray) {
  const storedProjects = store.get('projects');
  const projects = storedProjects ? JSON.parse(storedProjects) : [];
  const locale = { "add": "Adicionar Pasta", "close": "Fechar Code Tray", "remove": "Remover" }


  const items = projects.map(({ name, path }) => ({
    label: name,
    submenu: [
      {
        label: locale.remove,
        click: () => {
          store.set('projects', JSON.stringify(projects.filter(item => item.path !== path)));
          render();
        },
      },
    ],
  }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: locale.add,
      enabled: (items.length == 1) ? false : true,
      click: () => {
        const result = dialog.showOpenDialog({ properties: ['openDirectory'] });
        if (!result) return;
        const [path] = result;
        const name = basename(path);
        store.set('projects', JSON.stringify([...projects, { path, name, },]));
        render();
      },
    },
    { type: 'separator' },
    ...items,
    { type: 'separator' },
    {
      type: 'normal',
      label: locale.close,
      role: 'quit',
      enabled: true,
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', tray.popUpContextMenu);
}

function remove(dir) {
  fs.unlink(dir, (err) => {  //remove Arquivo apos impressão usar depois
    if (err) {
      console.log('Houve algum erro!', err);
    } else {
      console.log('Tudo certo! Arquivo removido.');
    }
  })
}


async function delay(ms) {
  // return await for better async stack trace support in case of errors.
  return await new Promise(resolve => setTimeout(resolve, ms));
}

async function impressao(string) {

  let item = (string) ? JSON.parse(string) : null;
  if (item != null && item.length > 0) {
    let dir = item[0].path;
    let files = fs.readdirSync(dir);
    if (files.length > 0) {
      for await (let f of files) {
        if (f != 'undefined' && f.indexOf('jv') > -1 && f.split('.').pop() == 'pdf') {
          try {
            if (await NodePdfPrinter.printFiles([dir + '\\' + f])) {
              remove(dir + '\\' + f);
            }
          } catch (error) {
            console.error(error)
          }

        }
      }
      await delay(5000);
      impressao(store.get('projects'));
    } else {
      await delay(10000);
      impressao(store.get('projects'));
    }
  } else {
    await delay(10000);
    impressao(store.get('projects'));
  }
}

app.on('ready', async () => {
  mainTray = new Tray(resolve(__dirname, 'assets', 'iconTemplate.png'));
  render(mainTray);
  impressao(store.get('projects'));
});
