/**
 * @module options
 * @description User-configurable options for scorecard generation
 * @author David Karalli
 */

import { WCIF } from './wcif.js'

// TODO: options need:
// - which type of option (inheritance)
// - an HTML representation corresponding to the type
// - data
export class Option {
    /* HTML data */
    /**
     * Input type, e.g. 'text', 'radio'
     * @type {string}
     */
    inputType;

    /**
     * Option ID, e.g. 'blanks-round-333-r1'
     * @type {string}
     */
    #id;

    /**
     * Human-readable text describing the input, e.g. 'Number of blanks for 3x3 Round 1'
     * @type {string}
     */
    inputText;

    // TODO: will need to change this for radio buttons
    /**
     * Default value of the input
     * @type {string}
     */
    defaultValue;

    /**
     * Value of the input
     * @type {string}
     */
    value;

    /**
     * Generate the ID that corresponds to the given arguments
     *
     * This is used to easily find an option when generating the PDFs
     *
     * Must be overridden by the child class
     *
     * @param  {...any} args 
     */
    static genId(...args) {
        throw new Error(`Called getOptionId on generic Option object. Args: ${args}`);
    }

    /**
     * Get the ID of the Option object
     *
     * @returns {string}
     */
    getId() {
        return this.#id;
    }

    /**
     * TODO: comment
     * @param {string} inputType
     * @param {string} inputText
     * @param {string} id
     * @param {string} defaultValue
     */
    constructor(inputType, inputText, id, defaultValue) {
        this.inputType = inputType;
        this.#id = id;
        this.inputText = inputText;
        this.defaultValue = defaultValue;
        this.value = defaultValue;
    }
};

// TODO: show the default value in a corner as grayscale
// TODO: validate as a reasonable positive integer, or only let the user enter digits
export class RoundBlanksOption extends Option {
    /**
     * Generate the ID that corresponds to the given arguments
     *
     * @param {string} eventId - Event ID, e.g. '333'
     * @param {number} round - Round number
     * @returns {string} - input name, e.g. 'blanks-round-333-r1'
     */
    static genId(eventId, round) {
        return `blanks-round-${eventId}-r${round}`;
    }

    // TODO: use human-readable event names
    // TODO: use human-readable rounds, e.g. 'Final'... we'll need the WCIF for this :)
    /**
     * Generate input text for the event ID and round
     *
     * Overrides parent method
     *
     * @param {string} eventId - Event ID, e.g. '333'
     * @param {number} round - Round number
     * @returns {string} - input text, e.g. 'Number of blank scorecards for 333 Round 1:'
     */
    static getInputText(eventId, round) {
        return `${eventId} Round ${round}: `;
    }

    /**
     * @param {string} eventId - Event ID, e.g. '333'
     * @param {number} round - Round number
     * @param {number} defaultValue - Default number of blank scorecards
     */
    constructor(eventId, round, defaultValue) {
        const inputText = RoundBlanksOption.getInputText(eventId, round);
        const id = RoundBlanksOption.genId(eventId, round);

        super(
            'text',
            inputText,
            id,
            defaultValue,
        );
    }
}

export class OptionsTab {
    /** @type {string} */
    buttonText;

    /** @type {string} */
    #tabContentId;

    /** @type {string} */
    #tabButtonName;

    /** @type {Option[]} */
    options;

    /**
     * Description to show up at the top of the tab's content
     * @type {string}
     */
    desc;

    /**
     * Add an Option object to the array of options
     *
     * @param {Option} option
     */
    addOption(option) {
        this.options.push(option);
    }

    getTabContentId() {
        return this.#tabContentId;
    }

    getTabButtonName() {
        return this.#tabButtonName;
    }

    /**
     * TODO: comment
     * @param {string} buttonText - text to display on the button for the tab
     * @param {string} id - unique ID for identifying the div for the tab's content
     * @param {string} desc - description to show up at the top of the tab's content
     */
    constructor(buttonText, id, desc) {
        this.buttonText = buttonText;
        this.#tabContentId = `optionsTab-content-${id}`;
        this.#tabButtonName = `optionsTab-button-${id}`;
        this.options = [];
        this.desc = desc;
    }
}

/**
 * TODO: description
 * @param {WCIF} wcif - WCIF object
 * @param {string} eventId - Event ID, e.g. '333'
 * @param {number} round - Round number
 * @returns {number} - number of blanks for the round
 */
function getNumBlanksForRound(wcif, eventId, round) {
    const numCompetitors = wcif.getNumAdvancingToRound(eventId, round);

    // Fill in the final page with blanks, and add 1 page of blanks
    const numExtraBlanks = (4 * Math.ceil((numCompetitors + 4) / 4)) - numCompetitors;

    // If groups are already assigned, just add some emergency blanks
    if (wcif.groupsAreAssigned(eventId, round)) {
        return numExtraBlanks;
    }

    // If groups aren't already assigned, provide scorecards for filling in at the competition
    return numCompetitors + numExtraBlanks;
}

/**
 * TODO: description
 * @param {WCIF} wcif - WCIF object
 * @param {string} eventId - Event ID, e.g. '333'
 * @returns {Object} - TODO: describe; format is object['333'][1] = 5
 */
function getBlanksPerRoundByEvent(wcif, eventId) {
    const numRounds = wcif.getNumRounds(eventId);

    const blanksPerRound = {};

    for (let round = 1; round <= numRounds; round++) {
        blanksPerRound[round] = getNumBlanksForRound(wcif, eventId, round);
    }

    return blanksPerRound;
}

/**
 * TODO: description
 * @param {WCIF} wcif - WCIF object
 * @returns {Object} - TODO: describe; format is object['333'][1] = 5
 */
function getBlanksPerRound(wcif) {
    let blanksPerRound = {};

    for (const eventId of wcif.getEventIds()) {
        blanksPerRound[eventId] = getBlanksPerRoundByEvent(wcif, eventId);
    }

    return blanksPerRound;
}

// TODO: remove export
/**
 * TODO: description
 * @param {WCIF} wcif - WCIF object
 * @returns {OptionsTab} OptionsTab object
 */
export function optTabBlanks(wcif) {
    const optionsTab = new OptionsTab(
        'Blank scorecards',
        'numBlanks',
        'Enter the number of blank scorecards to generate for each round. The default values ensure each page of the PDF has all scorecard slots filled.',
    );

    const numBlanksObj = getBlanksPerRound(wcif);

    for (const eventId of Object.keys(numBlanksObj)) {
        const eventDict = numBlanksObj[eventId];
        for (const round of Object.keys(eventDict)) {
            const defaultValue = eventDict[round];
            optionsTab.addOption(new RoundBlanksOption(eventId, round, defaultValue));
        }
    }

    return optionsTab;
}

export function optTabTest(wcif) {
    const optionsTab = new OptionsTab(
        'Test tab',
        'test',
        'This is a test tab. Type whatever you want.',
    );

    for (let i = 0; i < 5; i++) {
        optionsTab.addOption(new Option('text', `test-input-${i}`, `Test text ${i}: `, i));
    }

    return optionsTab;
}

/**
 * TODO: description
 * @param {WCIF} wcif - WCIF object
 * @returns {OptionsTab[]} array of OptionsTab objects
 */
export function optTabsCreate(wcif) {
    const funcs = [
//        optRoomAbbrs,
//        optScGrouping,
        optTabBlanks,
        optTabTest,
    ];

    let optionsTabs = [];

    for (const func of funcs) {
        optionsTabs.push(func(wcif));
    }

    return optionsTabs;
}