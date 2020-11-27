import utils from './utils.js';

var controller = function (app) {
    if (!app) return false;
    // -------------------------
    // controller methods:
    // -------------------------
    function init () {
        return new Promise((resolve, reject) => {
            app.logger.trace("controller.init() starting...");

            // load external stylesheets
            loadStylesheets().then(response => app.logger.debug(`loadStylesheets() response: ${Object.values(response)}`));

            // load external scripts
            loadAllScripts()
                .then(loadResponse => {
                    app.logger.trace(`loadAllScripts(): ${loadResponse}`);
                    app.logger.info(`All js files loaded from /js/apps/*.js`);

                    let connection = app.load(app.settings.stores.connection);
                    if (connection) {
                        app.setStatus(1);
                        // todo: pre-populate form with host & apikey
                        buildMenu(app.get('configs').data)
                            .then(response => app.logger.trace(response))
                            .catch(e => app.logger.error(`Error showing menus! ${e}`));
                    } else {
                        app.setStatus(0);
                        app.logger.debug("No connection settings stored. User needs to authenticate.")
                        buildMenu();
                    }
                    // add mouse click handlers
                    addListeners();
                    resolve("Done Loading Scripts");
                })
                .catch(error => {
                    reject(`Error Loading Scripts! "${error}"`);
                });


        });
    }
    /**
     * load settings view or load last page viewd in previous session
     */
    function firstView () {
        let default_view = 'settings';
        let connected = app.get('status') === 1;
        let tab = !connected ? default_view : app.get('last_viewed');

        let configs = app.get('configs');

        // default to settings
        if (!tab) {
            tab = default_view;
        }
        // if connected, no last_viewd and configs available:
        //    go to the first app in the list...
        app.logger.debug(`firstView() loading: "${tab}"`);
        if (connected && tab === default_view) {
            try {
                tab = Object.values(configs.data)[0].app;
            } catch (error) {
                // displaying error not needed
            }
        }

        toggleTab(tab, true)
            .then(() => showStatus())
            .catch(error => app.logger.fatal(error));
    }

    function loadStylesheet (path, base) {
        if (typeof base === "undefined") {
            base = document.baseURI;
        }
        return new Promise((resolve, reject) => {
            let url;
            try {
                url = new URL(path, base);
            } catch (error) {
                let msg = `Stylesheet path not valid! "${path}" : ${error}`;
                app.logger.fatal(msg);
                reject(msg);
            }
            if (url) {
                let link = document.createElement("link");
                link.href = url.href;
                link.type = "text/css";
                link.rel = "stylesheet";
                link.media = "screen,print";
                document.getElementsByTagName("head")[0].appendChild(link);

                link.onload = () => resolve(link);
                link.onerror = () => reject(`Style load error for ${path}`);
                document.head.append(link);
            }
        })
    }

    function loadStylesheets () {
        let promises = [];
        const stylesheets = [
            "css/apps/octopus-agile.css",
            "css/apps/mysolarpv.css",
        ];
        stylesheets.forEach(src => {
            promises.push(loadStylesheet(src));
        });
        return Promise.all(promises);
    }
    function unloadStylesheet (url) {
        let link = document.querySelector(`link[href="${url}"]`);
        if (link) {
            link.disabled = true;
        }
    }

    /**
     * calls loadScript() for each file to load
     * @returns {Promise}
     */
    function loadAllScripts () {
        let promises = [];
        const scripts = [
            // "js/apps/octopus-agile.js",
            "js/apps/myelectric2.js",
            // "js/apps/mysolarpv.js",
            // "js/apps/mysolarpvdivert.js",
            // "js/apps/myelectric.js",
            // "js/apps/myheatpump.js",
        ];
        scripts.forEach(src => {
            promises.push(loadScript(src));
        });
        return Promise.all(promises);
    }
    /**
     * 
     * @param {string} src path to set as <script> tag src
     */
    function loadScript (src) {
        return new Promise((resolve, reject) => {
            app.logger.trace(`Loading "${src}"...`);
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = src;
            script.onload = function () {
                resolve(`Loaded "${src}"`);
            };
            script.onerror = function () {
                reject(`Failed to load "${src}"!`);
            };
            document.getElementsByTagName("head")[0].appendChild(script);
        });
    }

    function darkMode (isDark) {
        app.logger.trace(`setting dark mode.. ${isDark}`);
        document.body.classList.toggle('dark', isDark);
    }
    /**
     * get all app settings
     * resolves with an object with key for each app
     * @param {boolean} cacheBusting true=always load from api
     * @returns {object} with last_updated and data properties
     */
    function loadSavedAppSettings (cacheBusting) {
        return new Promise((resolve, reject) => {
            // load local storage version if available
            if (!cacheBusting) {
                let app_settings = app.load(app.settings.stores.app_settings);
                if (app_settings) {
                    resolve(app_settings);
                }
            }
            // if no cached version, download
            downloadAppSettings()
                .then(settings => resolve(settings))
                .catch(error => reject(`Error downloading App Settings! ${error}`));
        });
    }
    function downloadAppSettings () {
        return new Promise((resolve, reject) => {
            // mock response
            app.logger.fatal("!!! MOCKING /app/list.json RESPONSE");
            const mockResponse = { "My Electric": { "app": "myelectric", "config": { "use_kwh": "2", "use": "1", "unitcost": "0.1636", "kw": true } }, "My Electric 2": { "app": "myelectric2", "config": { "use": "1", "use_kwh": "2", "unitcost": "0.1636" } }, "My Solar": { "app": "mysolarpv", "config": { "use": "1", "solar": "49", "use_kwh": "2", "solar_kwh": "49", "import_kwh": "2" } }, "Octopus Agile": { "app": "octopus", "config": { "region": "D_Merseyside_and_Northern_Wales", "import_kwh": "2", "import": "1", "use_kwh": "2" } }, "My Solar Divert": { "app": "mysolarpvdivert", "config": { "kw": true } }, "My Heatpump": { "app": "myheatpump", "config": {} } }

            const indexes = Object.keys(mockResponse);
            let filteredApps = Object.values(mockResponse).reduce((acc, curr, index) => {
                if (app.settings.allowed_apps.indexOf(curr.app) > -1) {
                    acc[indexes[index]] = curr;
                }
                return acc;
            }, {});
            resolve({
                last_updated: new Date(),
                data: filteredApps
            });

            return;
            let url = `${_HOST}/app/list.json`;
            cordova.plugin.http.get(url, utils.valuesToStrings({
                apikey: _API_KEY,
                userid: _USER_ID
            }), {}, function (response) {
                app.logger.debug(`GET SUCCESS ${url}`);
                app.logger.trace(`Loaded ${Object.keys(response).length} items from : ${url}`);
                let settings = response;
                if (!response || response === null || response === "") {
                    app.logger.fatal(`app.list invalid response: ${response}`);
                    feeds = null;
                }
                resolve({
                    last_updated: new Date(),
                    data: settings
                });
            }, function (response) {
                app.logger.error(response);
                reject('Error loading app list!');
            });
        })
    }



    /**
     * @returns {HTMLElement}
     */
    function buildMenuItem (label, href, css, data) {
        if (typeof css === "undefined") {
            css = [];
        }
        if (typeof data === "undefined") {
            data = {};
        }
        const template = document.querySelector("#top-nav-item");
        if (!template) {
            app.logger.fatal("No menu item template found!");
            return document.createDocumentFragment();
        }
        let clone = template.content.cloneNode(true);
        let link = clone.querySelector('a');
        link.textContent = label;
        link.classList.add(...css);
        link.href = href;
        for (let n in data) {
            link.dataset[n] = data[n];
        }
        return clone;
    }
    function buildMenu (settings) {
        return new Promise((resolve, reject) => {
            const container = document.querySelector("#top-nav");
            if (!container) {
                app.logger.fatal("No menu container found!");
                reject("controller.buildMenu() error!");
            }
            container.innerHTML = "";
            container.appendChild(buildMenuItem('☰', '#settings', ['fixed'], { app: 'settings' }));

            if (!settings) {
                let elem = buildMenuItem("Setup...", "#settings");
                container.appendChild(elem);
            }

            for (let name in settings) {
                let item = settings[name];
                let label = name;
                let href = `#${item.app}`;
                let css = [];
                if (typeof _DEFAULTAPP !== "undefined" && item.app === _DEFAULTAPP) {
                    css.push('active');
                }
                let data = { app: `${item.app}` }
                let elem = buildMenuItem(label, href, css, data);

                container.appendChild(elem);
            }
            resolve('Menu built');
        });
    }
    function getTabLink (id) {
        let link = document.querySelector(`[href="#${id}"]`);
        if (Number.isInteger(id)) {
            let container = document.querySelector("#top-nav");
            if (container) {
                link = container.querySelectorAll("a")[id];
            }
        }
        return link;
    }
    /**|
     * return tab container element
     * @param {string|number} id css selector or app.state.configs index
     * @returns {HTMLElement}
     */
    function getTab (id) {
        if (typeof id === "undefined") {
            return false;
        }
        let selector = `#${id}`;
        if (Number.isInteger(id)) {
            let configs = app.get('configs');
            selector = `#${Object.values(configs.data)[id].app}`;
        }
        let tab = document.querySelector(selector);
        return tab;
    }
    /**
     * toggle tab content visibility. forces state with isVisible switch.
     * @param {string} id element selector 
     * @param {boolean} isVisible 
     */
    function toggleTab (id, isVisible) {
        return new Promise((resolve, reject) => {
            $("section.fade").removeClass('in');
            let tab = getTab(id);
            if (tab) {
                // add "in" class to "fade in" the element
                tab.classList.toggle('in', isVisible);

                var url = `./html/${id}.html`;
                loadMarkup(url)
                    .then(response => {
                        // display page
                        let content = getMarkupPartial(response.data);
                        tab.dataset.src = url;
                        tab.dataset.lastUpdated = response.last_updated;
                        tab.innerHTML = content;
                    })
                    .catch(error => app.logger.fatal(`Error loading markup! ${error}`))
                    .finally(() => {
                        // trigger active state in tab toggle
                        toggleTabLink(id, isVisible)
                            .then(() => resolve())
                            .catch(error => reject(`Error highlighting tab! ${error}`));

                        // load app scripts once DOM updated
                        if (!app.loadApp(id)) {
                            app.logger.error(`Unable to load app! "${id}". User needs to auth.`);
                        }
                    })
            }
        })
    }
    /**
     * store xhr response in localStorage
     * @param {string} url uri of element to be cached. used as index
     * @param {object} response returned xhr response
     */
    function cacheResponse (url, response) {
        return new Promise((resolve, reject) => {
            let cache = app.load(app.settings.stores.pages) || {};
            if (typeof response.data !== "string") {
                response.data = response.data.innerHTML;
            }
            cache[url] = response;
            app.logger.trace(`Content Cached as ${url}`);
            app.logger.trace(`content: ${response.data.trim().substr(0, 50).trim() + '...'}`);
            app.save(app.settings.stores.pages, cache)
                .then(r => resolve(r))
                .catch(e => reject(`Error caching page! ${e}`));
        });
    }

    /**
     * load content via xhr
     * returns cached values if available
     * @param {string} url resource to load
     * @return {Promise} resolves with object {<last_updated|string>, <data|string>}
     */
    function loadMarkup (url) {
        return new Promise((resolve, reject) => {
            let cache = app.load(app.settings.stores.pages) || {};
            if (cache.hasOwnProperty(url)) {
                // todo: check latest_update for old cached values
                app.logger.debug(`💾 "${url}" loaded from cache`)
                resolve(cache[url]);
            } else {
                // todo: check for device (not browser emulator)
                app.logger.trace(`no cache found for ${url}...`)
                app.logger.fatal(`!!! MOCKING AJAX RESPONSE for "${url}"`);
                var xhr = new XMLHttpRequest();
                function failed (error) {
                    reject(`"${url}": ${error}`);
                }
                xhr.onerror = function (error) {
                    failed(`An error occurred loading file: ${error}`);
                }
                xhr.onload = function () {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        app.logger.info(`🔻 downloaded fresh copy of "${url}"`);
                        // store markup locally
                        let cacheObj = {
                            last_updated: new Date(),
                            data: xhr.response.body.innerHTML
                        }
                        cacheResponse(url, cacheObj).then(response => {
                            app.logger.trace(`Page successfully cached: ${response}`);
                            resolve(cacheObj)
                        }).catch(e => {
                            reject(`Error caching ajax response! ${e}`);
                        });

                    } else {
                        failed(`status: ${xhr.status}`);
                    }
                }
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === XMLHttpRequest.DONE) {
                        app.logger.trace(`[xhr status: ${xhr.status}]${url}`)
                    }
                };
                xhr.open("GET", url);
                xhr.responseType = "document";
                xhr.send();
                return;


                cordova.plugin.http.get(url, {}, {}, function (markup) {
                    app.logger.debug(`Loaded markup from from: ${url} `);
                    app.logger.trace(markup);
                    if (!markup || markup === null || markup === "") {
                        app.logger.fatal(`loadMarkup() invalid response: ${markup} `);
                    }
                    resolve({
                        last_updated: new Date(),
                        data: markup
                    });
                }, function (response) {
                    app.logger.error(response);
                    console.error(response);
                    reject(`Error loading tap markup! ${response} `);
                });
            }
        })
    }
    /**
     * get part of document based on a css selector pattern
     * @param {HTMLElement} body tag from included page
     * @param {string} selector selector to filter out part of dom
     * @returns {HTMLElement}
     */
    function getMarkupPartial (body, selector) {
        if (typeof selector === "undefined") return body;
        let partial;
        try {
            partial = body.querySelector(selector);
            if (!partial) {
                let fragment = document.createElement("div");
                fragment.innerHTML = body.innerHTML;
                partial = fragment;
            }
            app.logger.trace(`partial: ${partial.innerHTML} `);
            return partial;
        } catch (error) {
            app.logger.error(error);
        }
        app.logger.error(`no html partial matched! "${selector}" in ${body.innerHTML} `)
        return false;
    }
    function toggleTabLink (id, isActive) {
        return new Promise((resolve, reject) => {
            $("#top-nav a").removeClass('active');
            let link = getTabLink(id);
            if (link) {
                link.classList.toggle('active', isActive);
                link.scrollIntoView({
                    behavior: "smooth",
                    block: "end",
                    inline: "center"
                });
                resolve(`Tab found and active: "${id}"`);
            } else {
                reject(`No tab link found! "${id}"`);
            }
        })
    }
    function toggleAuthMethod () {
        $('#settings .auth').each(function (index, elem) {
            $(elem).toggleClass('d-none');
        });
    }
    function storeApiKey (apikey) {
        resolve(response);
        localStorage.setItem('apikey', apikey);
    }
    /**
     * show connection status to user
     * @param {number} status -1=error,0=waiting,1=ok
     */
    function showStatus (status, message) {
        if (typeof status === "undefined") {
            status = app.get('status');
        }
        if (typeof message === "undefined") {
            message = "status: ";
        }
        let error_message = `${message} ${app.settings.statuses[status]}`

        // text description
        let container = document.querySelector('#settings #connection_status');
        if (container) {
            container.classList.remove(...Object.values(app.settings.status_text_classes));
            container.classList.add(app.settings.status_text_classes[status]);
            container.innerText = error_message;
        }

        let connection = app.load(app.settings.stores.connection);
        if (connection && container) {
            container.innerText = `status: ${app.settings.statuses[status]} to "${connection.hostname}"`;
        }


        // dropdown button
        let $dropdown = $('#settings #app_login_forms');
        let $button = $dropdown.find('summary');
        $button.removeClass(Object.values(app.settings.status_btn_classes).join(' '));
        $button.addClass(app.settings.status_btn_classes[status]);
        $button.text(app.settings.status_btn_text[status]);

        // disconnect button
        let $disconnect = $('#settings nav #app_disconnect').toggleClass('d-none', status === 1);
        $disconnect.toggleClass('d-none', status !== 1);
    }
    // used by both authorizeUser and authenticateUser to save response
    function userGranted (apiResponse) {
        let host = apiResponse.hostname;
        let apikey = apiResponse.apikey;

        app.logger.info(`Authorized on ${host} using apikey: ${apikey} `);
        app.save(app.settings.stores.connection, apiResponse)
            .then(storeResponse => {
                app.logger.debug(`Auth response saved: ${storeResponse}`);
                // starts app with correct status
                init();
                let dropdown = document.querySelector("#app_login_forms");
                if (dropdown) {
                    dropdown.removeAttribute("open");
                }
                setTimeout(() => window.location.reload(true), 1000);
            })
            .catch(error => app.logger.error(`Error saving user!:${error}`));
    }
    // save apikey details to local storage 
    // (APIKEY access)
    function authorizeUser (event) {
        app.setStatus(0);

        event.preventDefault();
        let form = event.target;
        let formData = new FormData(form);
        // default to https on emoncms.org
        let host = formData.get("host") === "emoncms.org" ? "https://emoncms.org" : formData.get("host");
        let apikey = formData.get("apikey");
        // validate input
        if (host === "" || apikey === "") {
            return false;
        }
        app.authorize(host, apikey)
            .then(apiResponse => apiResponse.data)
            .then(userGranted)
            .catch(error => {
                app.logger.error(`Unable to authorize on ${host} using apikey: ${apikey}: ${error}`);
                showStatus(-1, error)
            });
    }
    // save user details to local storage 
    // (USERNAME & PASSWORD access)
    function authenticateUser (event) {
        app.setStatus(0);

        event.preventDefault();
        let formData = $(event.target).serialize();
        app.authenticate(formData)
            .then(response => {
                if (response.data) {
                    return response.data;
                } else {
                    return response;
                }
            })
            .then(data => {
                let dave = data;
                userGranted(data);
            })
            .catch(error => {
                app.logger.error(`Authentication error!: ${error}`);
                showStatus(-1, error);
            });
    }
    // #### merged with showStatus
    // function notifyUser (status, error) {
    //     if (typeof status === "undefined") {
    //         status = 0;
    //     }
    //     let statusText = app.settings.statuses[status] || "";
    //     let message = `${statusText} - ${error}`;
    //     let statusCssClass = app.settings.status_text_classes[status];
    //     let container = document.querySelector('#settings #connection_status');
    //     if (container) {
    //         container.classList.remove(...Object.values(app.settings.status_text_classes));
    //         container.classList.add(statusCssClass);
    //         container.innerText = message;
    //     }
    // }
    /**
     * @param {HTMLElement} link clicked link / tab toggle
     */
    function changeTab (link) {
        let href;
        try {
            href = new URL(link.href);
        } catch (error) {
            app.logger.error(`New tab link not valid URL!: "${link}"`);
        }
        // if href valid, load the script
        if (href) {
            var id = href.hash.substr(1);
            // only use the hash of the href
            toggleTab(id, true);
        }
    }

    function addListeners (force) {
        // only add listeners once.
        if (window.addedEventListeners === true && force !== true) {
            app.logger.trace("Event listeners already active. Not duplicating");
            return false;
        }
        let ele = document.querySelector("#top-nav");
        let pos = { top: 0, left: 0, x: 0, y: 0 };
        const mouseMoveHandler = function (e) {
            const dx = e.clientX - pos.x;
            const dy = e.clientY - pos.y;
            ele.scrollTop = pos.top - dy;
            ele.scrollLeft = pos.left - dx;
        };
        const navClickHandler = function (event) {
            event.preventDefault();
            app.logger.trace(event.type, event.target.tagName);
            let link = event.target.nodeName === "A" ? event.target : event.target.closest("a");

            // close options menu item is already `active`
            if (link.classList.contains('fixed') && link.classList.contains('active')) {
                closeMenuTabHandler(event);
            } else {
                changeTab(link);
            }
        }
        const closeMenuTabHandler = function (event) {
            event.preventDefault();
            let nextTab = app.get('last_viewed');
            if (!nextTab) {
                nextTab = 1;
            }
            toggleTab(nextTab, true);
        }
        const toggleAuthMethodHandler = function (event) {
            app.logger.trace('switching auth method...');
            event.preventDefault();
            toggleAuthMethod();
            app.logger.trace(event.type)
        }

        const mouseUpHandler = function () {
            ele.style.cursor = 'grab';
            ele.style.removeProperty('user-select');
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
        };
        const mouseDownHandler = function (event) {
            ele.style.cursor = 'grabbing';
            ele.style.userSelect = 'none';
            pos = {
                // The current scroll 
                left: ele.scrollLeft,
                top: ele.scrollTop,
                // Get the current mouse position
                x: event.clientX,
                y: event.clientY,
            };

            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        };

        app.logger.trace("adding event listeners...")
        $(document).on("click", "#top-nav a", navClickHandler);
        $(document).on("click", "#settings .close-tab", closeMenuTabHandler);
        $(document).on("click", "#settings .toggleAuthMethod", toggleAuthMethodHandler);

        $(document).on("submit", "#app_authorize", authorizeUser);
        $(document).on("submit", "#app_authenticate", authenticateUser);
        $(document).on("click", "#app_disconnect", app.disconnect);
        $(document).on("click", "#app_clear_cache", app.clear_cache);

        $(document).on("mousedown", "#top-nav", mouseDownHandler)
        window.addedEventListeners = true;
    }

    // -------------------------
    // controller "public functions":
    // -------------------------
    return {
        init,
        loadSavedAppSettings,
        buildMenu,
        toggleTab,
        addListeners,
        loadStylesheets,
        firstView,
        getTab,
        darkMode,
        showStatus
    };
};

export default controller;