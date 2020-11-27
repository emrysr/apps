/**
 * wrapper for gettext like string replace function
 * @todo: create a central js translation system for all modules.
 * @author: emrys@openenergymonitor.org
 */

const getText = (function () {
    /**
     * emulate the php gettext function for replacing php strings in js
     */
    function translate (property) {
        var _strings = {};
        if (typeof translations === 'undefined') {
            if (typeof getTranslations === 'function') {
                _strings = getTranslations();
            }
        } else {
            _strings = translations;
        }
        if (_strings.hasOwnProperty(property)) {
            return _strings[property];
        } else {
            return property;
        }
    }
    return translate;
})();

// USAGE:-
/**
 * ADD THIS `getTranslations()` FUNCTION TO THE VIEW - 
 * FOR THE ABOVE FUNCTION TO HAVE STRINGS TO TRANSLATE
 * 
 * `gettext` searches through the templates for any `gettext` functions.
 * It then creates a `.po` file with all the required translation strings
 * 
 * THIS METHOD DOES NOT USE gettext. It relies on gettext to output the correct 
 * translations in the `getTranslations()` that js then reads.
 * 
 * @see: https://www.php.net/manual/en/function.gettext.php
 */

/*
eg:
<script>
/**
 * return an object of gettext translated strings used by JS
 * @return object
 * /
function getTranslations(){
    return {
        'ID': "<?= _('ID') ?>",
        'Value': "<?= _('Value') ?>",
        'Time': "<?= _('Time') ?>",
        'Updated': "<?= _('Updated') ?>"
    }
}
</script>
*/


export default getText;