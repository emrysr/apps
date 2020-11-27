const utilityScripts = (function () {
    /**
     * return copy of obj with all values set to type string
     * @param {object} obj
     * @returns {object} all the values of the object will be string
     */
    const valuesToStrings = function (obj) {
        return Object.keys(obj).reduce((o, key) => Object.assign(o, { [key]: String(obj[key]) }), {});
    };
    /**
     * @param {string} key
     * @param {*} value
     * @param {object} obj object to search
     * @returns {object} first child object matching key === value
     **/
    const find = function (key, value, obj) {
        let arr = Object.values(obj);
        return arr.reduce((acc, curr) => {
            if (curr[key] === value) {
                acc.push(curr);
            }
            return acc;
        }, [])[0];
    }

    function isIPAddress (input) {
        input = String(input);
        return !input.split(".")
            .map(ip => Number(ip) >= 0 && Number(ip) <= 255)
            .includes(false);
    }

    /**
     * parse url search params as object.
     * @param {string} serializedString url search string
     * @returns {object} key value pairs created from search string
     * eg: name=dave&country=uk  ---> {name:"dave", country: "uk"}
     */
    function deserialize (serializedString) {
        return serializedString.split("&").reduce((acc, curr) => {
            let name, value;
            [name, value] = curr.split('=');
            acc[name] = value;
            return acc;
        }, {});
    }

    function decodeHtml (html) {
        var txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
    }
    function decodeUri (str) {
        return decodeURIComponent(str);
    }

    return {
        valuesToStrings,
        find,
        isIPAddress,
        deserialize,
        decodeHtml,
        decodeUri
    };
})();

export default utilityScripts;