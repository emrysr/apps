import utils from './utils.js';
import Logger from './logger.js';
import Controller from './controller.js';
/**
 * default settings for app. (seaf/iife)
 * settings can be overwrote when `app.initialize(settings)` is ran
 * @returns {object}
 */
var settings = (function () {
    // prefix for localStorage saved data
    const _storePrefix = "emoncms_apps_";
    // key names for each item stored in localStorage (+prefix)
    const stores = {
        state: _storePrefix + "state",
        connection: (() => _storePrefix + "connection")(),
        app_settings: (() => _storePrefix + "app_settings")(),
        feeds: (() => _storePrefix + "feeds")(),
        pages: (() => _storePrefix + "pages")()
    }
    const debug = 3; //0=none,1=fatal,2=error,3=warn,4=info,5=debug,6=trace
    const allowed_apps = "myelectric2,mysolarpv,mysolarpvdivert,myheatpump".split(",");
    const default_state = {
        last_viewed: null,
        interval: null,
        status: 0,
        configs: {}
    }

    const status_text_classes = {
        '2': 'text-success',
        '1': 'text-success',
        '0': 'text-white',
        '-1': 'text-danger',
        '-2': 'text-danger'
    }
    const status_btn_classes = {
        '2': 'btn-success',
        '1': 'btn-success',
        '0': 'btn-primary',
        '-1': 'btn-danger',
        '-2': 'btn-danger'
    }
    const status_btn_text = {
        '2': 'Online',
        '1': 'Connected',
        '0': 'Connect',
        '-1': 'Failed',
        '-2': 'Offline',
    }
    const statuses = {
        '2': 'Online',
        '1': 'Connected',
        '0': 'Not Connected',
        '-1': 'Connection Failed!',
        '-2': 'Offline',
    }
    // connects to `http` hosts by default as local raspberry pis don't use ssl
    // defaults to `https` when connecting to emoncms.org
    const defaultSchema = "http://";
    const schema_pattern = new RegExp('^https?://');
    return {
        stores,
        debug,
        allowed_apps,
        default_state,
        defaultSchema,
        schema_pattern,
        statuses,
        status_text_classes,
        status_btn_classes,
        status_btn_text
    }
})();

/**
 * one global variable with app state
 * run app.initialize() when ready to begin app
 * 
 * @property {object} state - initialized as copy of `default_state`
 * @property {string} state.last_viewed name of last visited app
 * @property {integer} debug level. 0=none,1=fatal,2=error,3=warn,4=info,5=debug,6=trace
 * @property {initialize} initialize adds cordova event listener and overwrites settings
 * @property {function} onDeviceReady triggered when all the cordova code has loaded
 * @property {object} logger - instance of logger object with debugging functions
 * @property {object} settings - fixed app settings
 * @property {array}  settings.allowed_apps list of "approved" emoncms apps to work with
 * 
 */

let app = {
    logger: null,
    configs: {},
    settings: settings,
    state: {},
    /**
     * Application Constructor
     * default app "state" read from `settings.default_state`
     * "remembers" last state if localStore not empty
     * @param {object} settings override settings.settings as required
     */
    initialize: function (_settings) {
        try {
            this.settings = settings;
            // overwrite settings with options supplied in `_settings`
            if (_settings) {
                this.settings = Object.assign({}, settings, _settings);
            }
            this.state = app.load(app.settings.stores.state);
            if (!this.state) {
                this.state = this.settings.default_state;
            }
            // start the logger instance to output to console
            app.logger = new Logger(this.settings.debug);
            app.logger.info(`INIT(): Logging @ Level ${this.settings.debug} (${app.logger.LEVELS[this.settings.debug]})`);

            // REQUIRED! - cordova ready event...
            document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
            document.addEventListener("offline", this.onOffline.bind(this), false);
            document.addEventListener("online", this.onOnline.bind(this), false);

            return true;
        } catch (error) {
            return false;
        }
    },

    onDeviceReady: function () {
        // load app script once js file downloaded
        if (typeof controller.loadSavedAppSettings === "function") {
            controller.loadSavedAppSettings()
                .then(configs => {
                    app.saveAppConfigs(configs);
                })
                .catch(error => {
                    app.logger.error(`Error loading saved settings!: ${error}`);
                })
                .finally(() => {
                    if (typeof controller.init === "function") {
                        controller.init()
                            .then(response => {
                                app.logger.debug(`controller init() done: ${response}`);
                            })
                            .catch(error => app.logger.fatal(`Error initializing the controller!: ${error}`))
                            .finally(() => {
                                // jump to settings page to allow user to connect 
                                // (or last_viewed on previous session)
                                controller.firstView();
                                controller.showStatus();
                            })
                    } else {
                        app.logger.fatal("controller.init is not callable!");
                    }
                })
        } else {
            app.logger.fatal("controller.loadSavedAppSettings is not callable!");
        }
    },
    /**
     * set application state properties
     * overwrite localstore when updated
     * @param {string} key name of property to set
     * @param {*} value value of property
     */
    set: function (key, value) {
        app.state[key] = value;
        if (typeof app.save === "function") {
            return app.save(app.settings.stores.state, app.state)
                .then(storeResponse => {
                    app.logger.debug(`💾 "${key}" saved`);
                    app.logger.trace(`new state: ${JSON.stringify(app.state)}`);
                    app.logger.trace(storeResponse);
                })
                .catch(error => {
                    app.logger.error(`Error saving "${name}" to state!: ${error}`);
                    app.logger.debug(`Attempted to save X`)
                });
        } else {
            app.logger.fatal("app.save is not callable!");
        }
    },
    /**
     * get a property of app.state
     * @param {string} key name of app state property to return
     * @returns {*} value of app.state[key]
     */
    get: function (key) {
        let value;
        if (app.state.hasOwnProperty(key)) {
            value = app.state[key];
        }
        app.logger.trace(`state["${key}"] (${value})`);
        return value;
    },
    /**
     * remove app.state property
     * @param {string|array} key name of key(s) to remove
     */
    delete: function (keys) {
        let keys_arr = Object.assign([], [...keys]);
        let success = true;
        try {
            keys_arr.forEach(key => {
                delete app.state[key];
            })
        } catch (error) {
            success = false;
            app.logger.error(`Error deleting state property "${error}"`);
        }
        return success;
    },
    /**
     * update single property in app state
     * @param {string} key name of property to modify
     * @param {*} value the new value
     */
    update: function (key, value) {
        let stored_state = app.load(name);
        let new_state = Object.assign({}, stored_state, app.state);
        app.set(app.settings.stores.state, new_state)
    },
    /**
     * store value in data store. will overwrite whole value!
     * @see `update()` for way to add to app state
     * @param {string} key name of value to save
     * @param {*} value of data to save
     * @returns {Promise} rejected if issue with data store, else resolves
     */
    save: function (key, value) {
        return new Promise((resolve, reject) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                app.logger.trace(`value for "${key}": ${JSON.stringify(value).substr(0, 50).trim()} `);
                resolve(`💾 "${key}" saved`);
            } catch (error) {
                reject(error.message);
            }
        })
    },
    /**
     * Get data by name from localStorage. Stores as string.
     * Returns `null` if value not found or value cannot be parsed as JSON.
     * @param {string} key index/key for value stored in localStorage
     * @returns {*} parses string in localStore as JSON and return value.
     */
    load: function (key) {
        let value = null;
        try {
            value = JSON.parse(localStorage.getItem(key));
        } catch (error) {
            app.logger.fatal(`Error parsing JSON data in local store: "${key}"`)
        }
        return value;
    },
    onOffline: function () {
        // todo: notify user that device is offline.
    },
    onOnline: function () {
        // todo: remove offline notification
    },
    /**
     * remove all local storage values.
     * keeps auth settings... `app.disconnect()` removes that
     */
    clear_cache: function () {
        let listToEmpty = Object.values(app.settings.stores).reduce((acc, curr) => {
            if (curr !== app.settings.stores.connection) {
                acc.push(curr);
            }
            return acc;
        }, []);
        // empty local store for each property
        listToEmpty.forEach(item => {
            localStorage.removeItem(item);
            app.logger.trace(`"${item}" deleted from localStorage`)
        });
        // also clear app state
        let keys = 'configs,config,last_viewed'.split(',');
        app.delete(keys);
        app.logger.trace(`"${JSON.stringify(keys)}" deleted from localStorage`)

        app.logger.info("💾 Local storage cache now empty");
        app.setStatus(0);
        window.location.reload(true);
    },
    /**
     * clears user auth credentials
     * causes the user to have to re-authenticate
     */
    disconnect: function () {
        app.logger.info("Disconnecting...");
        localStorage.removeItem(app.settings.stores.connection);
        app.setStatus(0);
        window.location.reload(true);
    },

    /**
     * test apikey on host
     * @returns {Promise<object>} {hostname:'',apikey:''}
     **/
    authorize: function (host, apikey) {
        return new Promise((resolve, reject) => {
            if (app.settings.dev) {
                // mock response
                app.logger.fatal("!!! MOCKING /user/get.json RESPONSE");
                resolve({
                    hostname: "http://emonpi.home",
                    apikey: "40b8927d107619ec782783d8c7090709"
                });
            } else {
                // real response5
                let hostAndSchema = host.match(app.settings.schema_pattern) ? host : `${app.settings.defaultSchema}${host}`;
                let url = `${hostAndSchema}/user/get.json?apikey=${apikey}`;
                try {
                    url = new URL(url).href;
                } catch (error) {
                    reject(`Not valid authentication URL!: ${url} `);
                }
                app.logger.debug('authorizing at host')
                cordova.plugin.http.get(url, {}, {},
                    function (response) {
                        let responseData = JSON.parse(response.data);
                        if (responseData.success !== false) {
                            app.logger.trace(`user: get() responded with: ${response.status} ${response.data}`);
                            resolve({
                                data: responseData,
                                response: response
                            });
                        } else {
                            app.logger.error(`authorization not successful: ${response.status} `);
                            reject('Server not responding correctly!');
                        }

                    }, function (response) {
                        let error;
                        if (response.error) {
                            error = response.error;
                        } else {
                            error = response;
                        }
                        app.logger.error(`Error with http request! "${url}": ${error}`);
                        // 'Error authorizing with given credentials! Please try again'
                        reject(error);
                    });
            }
        });
    },

    /**
    * login to host using username & password
    * @returns {object} {hostname:'',apikey:''}
    **/
    authenticate: function (serializedString) {
        let decodedString = utils.decodeUri(serializedString);
        app.logger.debug(`Authenticating with...${decodedString} `);
        let data = utils.deserialize(decodedString.replace(/\+/g, '%20'));
        let path = "/user/auth.json";
        let host = data.host.match(app.settings.schema_pattern) ? data.host : `${app.settings.defaultSchema}${data.host}`;
        let url;
        return new Promise((resolve, reject) => {
            if (data.host === '') {
                reject('Empty hostname!')
            }
            if (app.settings.dev) {
                // mock response
                app.logger.fatal("!!! MOCKING /user/auth.json RESPONSE");
                resolve({
                    hostname: "http://emonpi.home",
                    apikey: "40b8927d107619ec782783d8c7090709"
                });
            } else {
                app.logger.debug('authenticating at host')
                try {
                    url = new URL(`${host}${path}`).href.trim();
                } catch (error) {
                    reject(`Not valid authentication URL!: ${url} `);
                }
                cordova.plugin.http.post(url, utils.valuesToStrings(data), {},
                    function (response) {
                        let responseData;
                        if (response.data) {
                            responseData = JSON.parse(response.data);
                            if (responseData.success === false) {
                                app.logger.error(`authentication not successful: ${response} `);
                                reject(`Error loggin in! ${responseData.message}`);
                            }
                        }
                        app.logger.trace(`${path} responded with: ${response} `);
                        resolve({
                            hostname: data.host,
                            apikey: responseData.apikey_write
                        });
                    }, function (response) {
                        let error;
                        let responseData;
                        let message;
                        if (response.data) {
                            responseData = JSON.parse(response.data);
                            message = responseData.message;
                        }
                        app.logger.error(`Error with http request! "${url}": ${message}`);
                        // 'Error authorizing with given credentials! Please try again'
                        reject(message);
                    });
            }
        });
    },
    /**
     * save all app configs to datastore from app state
     * @param {object} configs new list of app configs
     */
    saveAppConfigs: function (configs) {
        if (!configs) {
            app.logger.debug("no local app configs");
            return false;
        } else {
            configs.last_updated = new Date();
            app.set('configs', configs);
            if (typeof app.save === "function") {
                app.save(app.settings.stores.app_settings, app.state.configs)
                    .then(storeResponse => {
                        app.logger.debug(`💾 saveAppConfigs(): all app settings saved`);
                        app.logger.trace(`💾 saved: ${Object.keys(configs)}`);
                        app.logger.trace(storeResponse);
                    })
                    .catch(error => app.logger.error(`Error saving app settings!: ${error}`));
            } else {
                app.logger.fatal("app.save is not callable!");
            }
        }
    },
    setStatus: function (status) {
        app.logger.info(`Status changed to: "${app.settings.statuses[status]}" [${status}]`);
        app.set('status', status);

        controller.showStatus(status);
    },

    /**
     * pick up app settings and 
     * loads a given app and triggers different options based on name
     * @param {(string|integer)} name app name or app.state.configs index
     * @alias changeApp
     */
    loadApp: function (_name) {
        let name = _name;
        let configs = app.get('configs');
        let last_viewed = app.get('last_viewed');

        if (!configs.data) {
            // no config data! has user connected to server?
            app.logger.debug("no configs in app state!?");
        } else {
            if (last_viewed !== name) {
                // clear out previous app from DOM
                app.unloadApp(last_viewed);
            }
            if (Number.isInteger(name)) {
                name = Object.values(configs.data)[0].name;
            }
            app.logger.info(`✔ App set to "${name}"`);
            if (name !== "settings") {
                app.set('last_viewed', name);
            }
            let match = utils.find('app', name, configs.data);
            if (match) {
                app.set('config', match.config);
            } else if (name === "settings") {
                // no need to return error for settings
            } else {
                app.logger.error(`No config found for "${name}"!`)
                app.logger.trace(JSON.stringify(configs.data));
                // return;
            }
            app.logger.trace(`config changed to ${JSON.stringify(configs.data)}`)
            // remove previous interval loops
            if (app.interval) clearInterval(app.interval);
            // no data in app state! user need auth..
        }

        // overwrite app methods to be cordova compatible
        app.modifyMethods();

        // re-set local var configs (incase changed above)
        configs = app.get('configs');

        switch (name) {
            case "settings":
                controller.darkMode(true);
                controller.showStatus();
                break;
            case "myelectric":
                controller.darkMode(true);
                break;
            case "myelectric2":
                controller.darkMode(false);
                app.myelectric.updateValue();
                app.interval = setInterval(app.myelectric.updateValue, 10000);
                // console.log(configs.mysolarpv.feeds().then(_=>console.log('done')));
                break;
            case "mysolarpv":
                controller.darkMode(true);
                break;
            case "mysolarpvdivert":
                controller.darkMode(true);
                break;
            case "myheatpump":
                controller.darkMode(false);
                break;
            case "octopus":
                controller.darkMode(false);
                break;
            default:
                return false;
        }
        return true;
    },
    /**
     * empty the markup from dom to avoid clashing ids
     * @param {string} id css selector for tab container
     */
    unloadApp: function (id) {
        // todo: remove scripts
        app.logger.info(`❌ App unloaded "${id}"`);
        let tab = controller.getTab(`${id}`);
        if (tab) {
            tab.innerHTML = '';
        }
    },
    myelectric: {
        updateValue: function () {
            app.logger.info('🤖 new myelectric.updateValue()')
            cordova.plugin.http.get(`${_HOST}/feed/value.json`, utils.valuesToStrings({
                id: _FEED_ID_USE
            }), {}, function (response) {
                $("#value").html((response.data * 0.001).toFixed(1) + " kW");
            }, function (response) {
                app.logger.error(response.error);
            });
        }
    },

    /**
     * OVERWRITE METHODS THAT USE AJAX - (convert to cordova scripts)
     * -------------------------------
     * standard emoncms scripts use json that is considered un-safe in cordova
     * replace any ajax functions with 'cordova.plugin.http' functions
     * 
     */
    modifyMethods: function () {
        /**
         * @returns {Promise} 
         */
        const _GET_FEEDS = async function () {
            return new Promise((resolve, reject) => {
                var feeds = null;
                var url = `${_HOST}/feed/list.json?apikey=${_API_KEY}&userid=${_USER_ID}`;
                cordova.plugin.http.get(url, {}, {}, function (response) {
                    app.logger.debug(`GET SUCCESS ${url}`);
                    app.logger.trace(`Loaded ${response.length} items from : ${url}`);
                    feeds = response;
                    if (!response || response === null || response === "" || response.constructor !== Array) {
                        app.logger.fatal(`feed.list invalid response: ${response}`);
                        feeds = null;
                    }
                    resolve(feeds);
                }, function (response) {
                    app.logger.error(response);
                    reject('Error loading feed list!');
                });
            })
        }

        app.logger.fatal('!!! MOCKING /feeds/list.json RESPONSE');
        feed.list = async function () {
            (async () => {
                await _GET_FEEDS();
            })()
        };
        feed.list = () => console.log('not ready to lookup feeds/list.json');

        localStorage.setItem('feeds', JSON.stringify(_GET_FEEDS()))
    }

};

const controller = Controller(app);

export default app;