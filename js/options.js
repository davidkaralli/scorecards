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
        throw new Error(`Called genId on generic Option object. Args: ${args}`);
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
     * @param {string} id
     * @param {string} defaultValue
     */
    constructor(inputType, id, defaultValue) {
        this.inputType = inputType;
        this.#id = id;
        this.defaultValue = defaultValue;
        this.value = defaultValue;
    }
};

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

    /**
     * @param {string} eventId - Event ID, e.g. '333'
     * @param {number} round - Round number
     * @param {number} defaultValue - Default number of blank scorecards
     */
    constructor(eventId, round, defaultValue) {
        const id = RoundBlanksOption.genId(eventId, round);

        super(
            'number',
            id,
            defaultValue,
        );
    }
}

export class RoomOption extends Option {
    /**
     * Generate the ID that corresponds to the given arguments
     *
     * @param {string} eventId - Event ID, e.g. '333'
     * @param {number} round - Round number
     * @returns {string} - input name, e.g. 'blanks-round-333-r1'
     */
    static genId(room) {
        const roomNoSpaces = room.replace(' ', '-');
        return `room-abbr-${roomNoSpaces}`;
    }

    /**
     * @param {string} room - Room name
     * @param {number} defaultValue - Default room abbreviation (could be an empty string)
     */
    constructor(room, defaultValue) {
        const id = RoomOption.genId(room);

        super(
            'text',
            id,
            defaultValue,
        );
    }
}

export class OptionsTab {
    /** WCIF object
     * @type {WCIF}
     */
    wcif;

    /** @type {string} */
    tabName;

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
     * HTML content of the tab
     * @type {HTMLElement}
     */
    div;

    /**
     * Generate the HTML content for the tab. Must be overridden by child class.
     */
    #finishDiv() {
        throw new Error(`Called createDiv on generic Option object. Args: ${args}`);
    }

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
     * @param {string} tabName - text to display on the button for the tab
     * @param {string} id - unique ID for identifying the div for the tab's content
     * @param {string} desc - description to show up at the top of the tab's content
     * @param {WCIF} wcif - WCIF object
     */
    constructor(tabName, id, desc, wcif) {
        // Treat OptionsTab as an abstract base class
        if (new.target === OptionsTab) {
            throw new Error(`Cannot call OptionsTab constructor directly. tabName is "${tabName}."`)
        }

        this.tabName = tabName;
        this.#tabContentId = `optionsTab-content-${id}`;
        this.#tabButtonName = `optionsTab-button-${id}`;
        this.options = [];
        this.desc = desc;

        // Start creating the div
        this.div = document.createElement('div');

        this.div.id = this.#tabContentId;
        this.div.classList.add('tab-content');

        // Add description text to the div
        const descHtml = document.createElement('p');
        descHtml.textContent = this.desc;
        descHtml.classList.add('options-tab-description');
        this.div.appendChild(descHtml);

        this.wcif = wcif;
    }
}

class HelpOptionsTab extends OptionsTab {
    /**
     * TODO: comment
     * @param {WCIF} wcif - WCIF object
     */
    constructor(wcif) {
        const tabName = 'Help';
        const id = 'helpOptions';
        const desc = 'Click a tab to start customizing your scorecards. ' +
            'Once you\'re ready, click the "Download scorecards" button above.';

        super(tabName, id, desc, wcif);
    }

}

class BlanksOptionsTab extends OptionsTab {
    /**
     * Event listener to prevent the user from pasting '-' or '.'
     *
     * @param {Event} e - Event object (NOT a WCA event)
     */
    #beforeinputEventListener(e) {
        // Don't allow non-digit characters
        if (e.data && /\D/.test(e.data)) {
            e.preventDefault();
        }
    }

    /**
     * Create an HTML input element
     * @param {RoundBlanksOption} option - RoundBlanksOption object
     * @returns {HTMLInputElement}
     */
    #createInput(option) {
        const input = document.createElement('input');

        input.type = option.inputType;
        input.name = option.getId();

        input.inputmode = 'numeric';
        input.defaultValue = option.defaultValue;
        input.min = 0;

        input.classList.add('option-input');

        input.addEventListener('beforeinput',
            event => this.#beforeinputEventListener(event));

        return input;
    }

    /**
     * Finish generating the HTML content for the tab
     */
    #finishDiv() {
        const numBlanksObj = getBlankPagesPerRound(this.wcif);

        // Create the table
        const table = document.createElement('table');
        table.classList.add('options-table');

        // Create the table header
        const thead = document.createElement('thead');

        // TODO: clean this up
        let tr;
        let th;

        tr = document.createElement('tr');
        th = document.createElement('th');
        th.classList.add('options-table');
        th.textContent = "Event";
        tr.appendChild(th);

        th = document.createElement('th');
        th.textContent = "Round";
        tr.appendChild(th);

        th = document.createElement('th');
        th.textContent = "Pages";
        tr.appendChild(th);
        thead.appendChild(tr);
        // TODO: add reset column

        const tbody = document.createElement('tbody');
        let input;
        let td;

        tr = document.createElement('tr');
        const bgClasses = ['odd-row', 'even-row'];
        let rowClassesInd = 0;

        for (const eventId of Object.keys(numBlanksObj)) {
            const eventDict = numBlanksObj[eventId];

            td = document.createElement('td');
            td.textContent = WCIF.eventIdToShortName[eventId];
            td.rowSpan = Object.keys(eventDict).length;
            tr.appendChild(td);

            for (const round of Object.keys(eventDict)) {
                // Create option object
                const defaultValue = eventDict[round];
                const option = new RoundBlanksOption(eventId, round, defaultValue);
                this.addOption(option);

                // Finish table row
                tr.classList.add(bgClasses[rowClassesInd]);

                td = document.createElement('td');
                td.textContent = round;
                tr.appendChild(td);

                td = document.createElement('td');
                input = this.#createInput(option);

                td.appendChild(input);
                tr.appendChild(td);

                tbody.appendChild(tr);

                // Creating the tr element here is odd, but intentional. The first round-specific row needs to be included in the same row as the multi-row event text.
                tr = document.createElement('tr');
            }

            rowClassesInd = (rowClassesInd + 1) % (bgClasses.length);
        }

        table.appendChild(thead);
        table.appendChild(tbody);
        this.div.appendChild(table);
    }

    /**
     * TODO: comment
     * @param {WCIF} wcif - WCIF object
     */
    constructor(wcif) {
        const tabName = 'Blank scorecards';
        const id = 'numBlanks';
        const desc = 'Enter the number of pages of blank scorecards to generate for each round.';

        super(tabName, id, desc, wcif);

        this.#finishDiv();
    }
}

class RoomOptionsTab extends OptionsTab {
    /**
     * Create an HTML input element
     * @param {RoomOption} option - RoomOption object
     * @returns {HTMLInputElement}
     */
    #createInput(option) {
        const input = document.createElement('input');

        input.type = option.inputType;
        input.name = option.getId();

        input.defaultValue = option.defaultValue;
        input.maxLength = 2;

        input.classList.add('option-input');

        return input;
    }

    /**
     * Finish generating the HTML content for the tab
     */
    #finishDiv() {
        const rooms = this.wcif.getRoomNames();

        // Create the table
        const table = document.createElement('table');
        table.classList.add('options-table');

        // Create the table header
        const thead = document.createElement('thead');

        // TODO: clean this up
        let tr;
        let th;

        tr = document.createElement('tr');
        th = document.createElement('th');
        th.classList.add('options-table');
        th.textContent = "Room";
        tr.appendChild(th);

        th = document.createElement('th');
        th.textContent = "Abbreviation";
        tr.appendChild(th);

        thead.append(tr);

        // TODO: add reset column

        const tbody = document.createElement('tbody');
        let input;
        let td;

        tr = document.createElement('tr');
        const bgClasses = ['odd-row', 'even-row'];
        let rowClassesInd = 0;

        // TODO: support natscript stages, e.g. WesternChampionship2025
        for (const room of rooms) {
            let defaultValue;
            if (rooms.length === 1) {
                // No need to label the room if there's only one
                defaultValue = '';
            } else {
                defaultValue = room[0].toUpperCase();
            }

            const option = new RoomOption(room, defaultValue);
            this.addOption(option);

            // Add table row
            tr = document.createElement('tr');
            tr.classList.add(bgClasses[rowClassesInd]);

            td = document.createElement('td');
            td.textContent = room;
            tr.appendChild(td);

            td = document.createElement('td');
            input = this.#createInput(option);
            td.appendChild(input);
            tr.appendChild(td);

            tbody.appendChild(tr);

            rowClassesInd = (rowClassesInd + 1) % (bgClasses.length);
        }

        table.appendChild(thead);
        table.appendChild(tbody);
        this.div.appendChild(table);
    }

    /**
     * TODO: comment
     * @param {WCIF} wcif - WCIF object
     */
    constructor(wcif) {
        const tabName = 'Rooms';
        const id = 'roomAbbrs';
        const desc = 'Enter an abbreviation (max 2 letters) for each room. ' +
            'This will show up in the "Group" field of a scorecard. ' +
            'If you\'d like, you can leave abbreviations blank.';

        super(tabName, id, desc, wcif);

        this.#finishDiv(wcif);
    }
}

/**
 * TODO: description
 * @param {WCIF} wcif - WCIF object
 * @param {string} eventId - Event ID, e.g. '333'
 * @param {number} round - Round number
 * @returns {number} - number of blanks for the round
 */
function getBlankPagesForRound(wcif, eventId, round) {
    // If groups are already assigned, just add a page of emergency blank scorecards
    if (wcif.groupsAreAssigned(eventId, round)) {
        return 1;
    }

    // If groups aren't already assigned, provide scorecards for filling in at the competition,
    // plus one page of extra blank scorecards
    const numCompetitors = wcif.getNumAdvancingToRound(eventId, round);
    const scPerPage = 4;

    return (numCompetitors / scPerPage) + 1;
}

/**
 * TODO: description
 * @param {WCIF} wcif - WCIF object
 * @param {string} eventId - Event ID, e.g. '333'
 * @returns {Object} - TODO: describe; format is object['333'][1] = 5
 */
function getBlankPagesPerRoundByEvent(wcif, eventId) {
    const numRounds = wcif.getNumRounds(eventId);

    const blanksPerRound = {};

    for (let round = 1; round <= numRounds; round++) {
        blanksPerRound[round] = getBlankPagesForRound(wcif, eventId, round);
    }

    return blanksPerRound;
}

/**
 * TODO: description
 * @param {WCIF} wcif - WCIF object
 * @returns {Object} - TODO: describe; format is object['333'][1] = 5
 */
function getBlankPagesPerRound(wcif) {
    let blanksPerRound = {};

    for (const eventId of wcif.getEventIds()) {
        blanksPerRound[eventId] = getBlankPagesPerRoundByEvent(wcif, eventId);
    }

    return blanksPerRound;
}

/**
 * TODO: description
 * @param {WCIF} wcif - WCIF object
 * @returns {OptionsTab[]} array of OptionsTab objects
 */
export function optTabsCreate(wcif) {
    const tabClasses = [
        HelpOptionsTab,
        RoomOptionsTab,
        BlanksOptionsTab,
    ];

    return tabClasses.map(cls => new cls(wcif));
}