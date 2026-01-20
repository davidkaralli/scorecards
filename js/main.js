
import { WCIF } from './wcif.js';
import { genScPdfsFromWcif } from './sc_pdf.js';
import { optTabsCreate, OptionsTab, Option } from './options.js';

const compIdForm = document.querySelector('#compIdForm');
compIdForm.addEventListener('submit', compIdToOptions);

const optionsForm = document.querySelector('#optionsForm');
const optionsFormInitialHTML = optionsForm.innerHTML;

const tabButtonDivId = 'optionsForm-tabButtonDiv'

/** @type {WCIF} */
let wcif = null;
/** @type {OptionsTab[]} */
let optionsTabArr = null;

async function compIdToOptions(event) {
    event.preventDefault(); // prevent the page from reloading

    optionsForm.innerHTML = optionsFormInitialHTML;

    const formError = document.querySelector('#formError');
    const compIdInput = event.target.elements.compId;
    // TODO: make this a singular CSS style

    // Clear any previous errors
    formError.textContent = '';
    formError.hidden = true;
    compIdInput.style.backgroundColor = '';

    const scFormData = new FormData(event.target);

    const compId = scFormData.get('compId');

    try {
        wcif = await WCIF.fromCompId(compId);
    } catch (err) {
        // TODO: make sure error message is provided to the user and then function exits
        console.log(err)
        if (err instanceof WCIF.HttpError) {
            // TODO: clearer definition of what "competition data" is, e.g. a screenshot of the WCA URL
            formError.textContent = 'Could not get competition data. Are you sure the competition ID is correct?';
            formError.hidden = false;
            compIdInput.style.backgroundColor = '#ffcccb';
            // TODO: clear the error on the next submission
        } else {
            // TODO: more generic error
        }

        return;
    }

    /* TODO: better name for this? */
    /* TODO: use nav instead of div? */
    const navButtonDiv = document.createElement('div');
    navButtonDiv.classList.add('options-form-nav-btn-row');

    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.textContent = 'Back';
    backButton.classList.add('options-form-nav-btn');
    backButton.classList.add('options-form-back-btn');
    backButton.addEventListener('click', optionsToCompId);

    const genButton = document.createElement('button');
    genButton.type = 'submit';
    genButton.textContent = 'Download scorecards';
    genButton.classList.add('options-form-nav-btn');
    genButton.classList.add('options-form-gen-btn');
    genButton.addEventListener('click', optionsToPdf);

    navButtonDiv.appendChild(backButton);
    navButtonDiv.appendChild(genButton);

    optionsForm.appendChild(navButtonDiv);

    optionsTabArr = optTabsCreate(wcif);

    let tabContainer = document.createElement('div');
    tabContainer.classList.add('tab-container');
    optionsForm.appendChild(tabContainer);

    let tabButtonDiv = document.createElement('div');
    tabButtonDiv.id = tabButtonDivId;
    tabButtonDiv.classList.add('options-tab-btn-row')

    tabContainer.appendChild(tabButtonDiv);

    let firstTab = true;
    for (const optionsTab of optionsTabArr) {
        const tabContentDiv = document.createElement('div');
        tabContentDiv.id = optionsTab.getTabContentId();

        console.log(tabContentDiv);
        tabContentDiv.classList.add('tab-content');
        // TODO: is this the best way to do this? i.e. can we just index into an array
        if (firstTab) {
            firstTab = false;
        } else {
            tabContentDiv.classList.add('tab-content--hidden');
        }

        const desc = document.createElement('p');
        desc.textContent = optionsTab.desc;
        desc.classList.add('options-tab-description');
        tabContentDiv.appendChild(desc);

        // Add options (i.e. the content of the tab)
        for (const option of optionsTab.options) {
            const p = document.createElement('p');
            tabContentDiv.appendChild(p);

            const input = document.createElement('input');
            input.type = option.inputType;
            input.name = option.getId();
            input.defaultValue = option.defaultValue;
            input.classList.add('option-input');
            // TODO: needs to be determined on an option-by-option basis, obviously
            input.type = 'number';

            const label = document.createElement('label');
            label.textContent = option.inputText;
            label.classList.add('option')
            label.appendChild(input);
            tabContentDiv.appendChild(label);
        }

        tabContainer.appendChild(tabContentDiv);

        // Create a button for the tab
        const button = document.createElement('button');
        button.type = 'button';
        button.name = optionsTab.getTabButtonName();
        button.textContent = optionsTab.buttonText;
        button.addEventListener('click', (event) =>
            displayOptionsTab(event, optionsTabArr, optionsTab.getTabContentId(), optionsTab.getTabButtonName())
        );
        button.classList.add('options-tab-btn');
        tabButtonDiv.appendChild(button);
    }

    tabButtonDiv.children[0].classList.add('options-tab-btn--active');

    // TODO: 'display' instead of 'hidden'
//    compIdForm.hidden = true;
    compIdForm.classList.add('form--hidden');
    optionsForm.classList.remove('form--hidden');
}

function optionsToPdf(event) {
    event.preventDefault();

    const options = optionsTabArr.flatMap(x => x.options);
    const optionsObj = {};

    const formData = new FormData(optionsForm);

    for (const option of options) {
        const id = option.getId();

        option.value =
            formData.get(id);

        optionsObj[id] = option;
    }

    genScPdfsFromWcif(wcif, optionsObj);
}

function optionsToCompId(event) {
    optionsTabArr = null;
    wcif = null;

    compIdForm.classList.remove('form--hidden');
    optionsForm.classList.add('form--hidden');
}

/**
 *
 * @param {*} event
 * @param {OptionsTab} optionsTabArr - Array of OptionsTab objects
 * @param {string} tabContentId - globally unique ID of the div corresponding to the desired tab's content
 * @param {string} tabButtonName - name of the tab's HTML button
 */
function displayOptionsTab(event, optionsTabArr, tabContentId, tabButtonName) {
    // Turn off all other options tabs
    for (const optionsTab of optionsTabArr) {
        const element = document.getElementById(optionsTab.getTabContentId());
        element.classList.add('tab-content--hidden');
    }

    let displayTab = document.getElementById(tabContentId);
    displayTab.classList.remove('tab-content--hidden');

    let tabButtonDiv = document.getElementById(tabButtonDivId);
    for (const child of tabButtonDiv.children) {
        if (child.name === tabButtonName) {
            child.classList.add('options-tab-btn--active');
        } else {
            child.classList.remove('options-tab-btn--active');
        }
    }
}