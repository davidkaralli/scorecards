
import { WCIF } from './wcif.js';
import { genScPdfsFromWcif } from './sc_pdf.js';
import { optTabsCreate, OptionsTab, Option } from './options.js';

const compIdForm = document.querySelector('#compIdForm');
compIdForm.addEventListener('submit', compIdToOptions);

const optionsForm = document.querySelector('#optionsForm');
const optionsFormInitialHTML = optionsForm.innerHTML;
optionsAddEventListeners(optionsForm);

const tabButtonDivId = 'optionsForm-tabButtonDiv'

/** @type {WCIF} */
let wcif = null;
/** @type {OptionsTab[]} */
let optionsTabArr = null;

function optionsAddEventListeners(form) {
    form.addEventListener('submit', optionsToPdf);
    form.elements.backButton.addEventListener('click', optionsToCompId);
}

function reinitOptionsForm(form) {
    form.innerHTML = optionsFormInitialHTML;
    optionsAddEventListeners(form);
}

async function compIdToOptions(event) {
    event.preventDefault(); // prevent the page from reloading

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
            input.name = option.inputName;
            input.defaultValue = option.defaultValue;

            const label = document.createElement('label');
            label.textContent = option.inputText;
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
    event.preventDefault(); // prevent the page from reloading

    genScPdfsFromWcif(wcif, optionsTabArr);
}

function optionsToCompId(event) {
    optionsTabArr = null;
    wcif = null;

    compIdForm.classList.remove('form--hidden');
    optionsForm.classList.add('form--hidden');

    // Reinitialize the options form to ensure old options aren't reused
    reinitOptionsForm(optionsForm);
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
            // TODO: better style
            child.classList.add('options-tab-btn--active');
        } else {
            child.classList.remove('options-tab-btn--active');
        }
    }
}