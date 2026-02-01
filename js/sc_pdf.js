/**
 * @module sc_pdf
 * @description Functions for generating the scorecard PDF
 * @author David Karalli
 */

import { WCIF } from './wcif.js';
import { Option, OptionsTab, RoomOption } from './options.js'
import { getScDataForEvent, SCData, CumulRoundInfo, SCType } from './sc_data.js';
import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';

applyPlugin(jsPDF);

import './fonts/OpenSans-normal.js';
import './fonts/OpenSans-bold.js';

// Left/right margin for text
const textMargin = 19.5;

// TODO: JSDoc
/* Similar to SCData, but SCData focuses on getting data from the WCIF,
 * while SCPDFData further processes that data for the PDF.
 */
export class SCPDFData {
    /**
     * Name of the competition
     * @type {string}
     */
    compName;

    /*** Person data ***/
    /** @type {string} */
    registrantId;
    /**
     * WCA ID, or 'New Competitor' for competitors without WCA IDs
     * @type {string}
     */
    wcaId;
    /**
     * Roman-readable part of the name
     * @type {string} */
    personNameRoman;
    /**
     * Translation; null if a translation isn't present
     * @type {string | null}
     */
    personNameTrans;

    /*** Event data ***/
    /**
     * Event and round, e.g. '3x3x3 Cube Round 1' or 'Square-1 Final'
     * @type: {string}
     */
    eventAndRoundText;
    /**
     * Number of attempts to list before the cutoff text
     * @type {number}
     */
    attemptsPreCutoff;
    /**
     * Number of attempts to list after the cutoff text, or null if the cutoff text is absent
     * @type {number | null}
     */
    attemptsPostCutoff;
    /**
     * Text at the end of the cutoff print, e.g. 'Continue if 1 or 2 < 6 minutes 25 seconds' or 'N/A'
     *
     * Null if the event doesn't support cutoffs (e.g. events with a Best of 3 format)
     *
     * @type {string | null}
     */
    cutoffText;
    /**
     * Text at the start of the time limit print; options are 'Time limit' or 'Cumulative time limit'
     * @type {string}
     */
    timeLimitStartText; // centiseconds

    /**
     * Text at the end of the time limit print, e.g. 'DNF if ≥ 6 minutes 25 seconds'
     *
     * Examples:
     *
     * 'DNF if ≥ 6 minutes 25 seconds' (for a non-cumulative time limit)
     *
     * '6 minutes 25 seconds' (for a single-round cumulative time limit)
     *
     * '1 hour for 4x4x4 Blindfolded Final and 5x5x5 Blindfolded Final' (for a cumulative time limit shared by 2 rounds)
     *
     * '1 hour, shared by 3 events' (for a cumulative time limit shared by 3 rounds; similar format is used for 3+ rounds)
     *
     * @type {string}
     */
    timeLimitEndText;

    /*** Group data ***/
    /**
     * Group, e.g. '1' or 'B2'
     * @type {string}
     */
    group;

    /**
     * Map-like object that converts formats (like 'a') to the number of attempts (like 5)
     * @type {Object.<string, number>}
     */
    #formatToAttempts = {
        'a': 5,
        'm': 3,
        '1': 1,
        '2': 2,
        '3': 3,
        '5': 5,
    };

    /**
     * Map-like object that converts formats (like 'a') to the number of pre-cutoff attempts on the scorecard if there is no cutoff.
     * @type {Object.<string, (number|null)>}
     */
    /*
     * Context: If no cutoff is available for an event that allows cutoffs, the scorecard needs to specify this as 'N/A'.
     *
     * If there's no cutoff for an event, we can't get the usual number of cutoff attempts from the WCIF, so that data
     * needs to be stored here.
     *
     * Notably, this doesn't work for multiblind since multiblind cutoff can be Best of 1 OR 2. But this software doesn't support
     * cutoffs for multiblind, so that's okay.
     */
    #formatToCutoffAttempts = {
        'a': 2,
        'm': 1,
        '1': null,
        '2': null,
        '3': null,
        '5': null,
    };

    /**
     * Extract the Roman-readable part and non-Roman translation from a name, and set the corresponding variables.
     *
     * @param {string} scDataName - Person name from the SCData object
     */
    #setNameData(scDataName) {
        /* In the WCA database, names can be formatted as follows:
         * - Roman-readable characters only, e.g. 'Jason Chang'
         * - Roman-readable characters followed by a translation in parentheses, e.g. 'Jason Chang (章維祐)'
         *
         * The following code sets the following variables:
         * - this.personNameRoman is set to the Roman-readable part (e.g. 'Jason Chang')
         * - this.personNameTrans is set to the translation (e.g. '章維祐')
         *
         * Regex isn't used here because the regex for this is hideous and hard to maintain
         */

        // Probably not needed, but protects against a space after the last parenthesis
        scDataName = scDataName.trim();

        const openParInd = scDataName.indexOf('(');

        if (openParInd === -1) {
            this.personNameRoman = scDataName;
            this.personNameTrans = null;
        } else {
            this.personNameRoman =
                scDataName
                .slice(0, openParInd)
                .trim();

            this.personNameTrans =
                scDataName
                .slice(openParInd + 1, -1) // exclude open and closed parentheses
        }
    }

    /**
     * Read the SCData object and set person-related SCPDFData members
     *
     * @param {SCData} scData - SCData object
     */
    #setPersonData(scData) {
        this.registrantId = String(scData.registrantId);
        this.wcaId = scData.newCompetitor ? 'New Competitor' : scData.wcaId;
        this.#setNameData(scData.personName);
    }

    /**
     * Return a string describing the event and round, relative to the total number of rounds
     *
     * @param {string} eventName - Human-readable event name, e.g. '3x3x3 Cube'
     * @param {number} round - Round number
     * @param {number} numRounds - Number of rounds of the event
     * @returns {string} e.g. '3x3x3 Cube Final', 'Square-1 Round 1'
     */
    #getEventAndRoundText(eventName, round, numRounds) {
        const roundText = (round === numRounds) ? 'Final' : `Round ${round}`;

        return `${eventName} ${roundText}`;
    }

    /**
     * Read the SCData object and set the event/round text member
     *
     * @param {SCData} scData
     */
    #setEventAndRoundText(scData) {
        this.eventAndRoundText = this.#getEventAndRoundText(scData.eventName, scData.round, scData.numRounds);
    }

    /**
     * Get the time text corresponding to the inputs
     *
     * @param {number} value - Time value; could be integer or floating point
     * @param {string} unit - Unit of time (e.g. 'second'); may pluralized by appending an 's'
     * @returns {string} Time text, e.g. '1 minute', '15 minutes', '6 hours', '6.25 seconds', '8 seconds', '8.01 seconds', '8.10 seconds', '' (if value === 0)
     */
    #getTimeTextPart(value, unit) {
        /* No need to display any text if value is 0 */
        if (value === 0)
            return '';

        const valueText = Number.isInteger(value) ? String(value) : value.toFixed(2);
        const unitText = (value === 1) ? unit : `${unit}s`;

        return `${valueText} ${unitText}`;
    }

    /**
     * Convert a duration in centiseconds to a human-readable duration
     *
     * @param {number} totalCentisec - Duration in centiseconds
     * @returns {string} Human-readable duration, e.g. '1 hour 6 minutes 25.12 seconds' or '1 minute'
     */
    #getTimeText(totalCentisec) {
        const hours = Math.trunc(totalCentisec / (100 * 60 * 60));
        const minutes = Math.trunc(totalCentisec / (100 * 60)) % 60;
        const seconds = (totalCentisec / 100) % 60; // Centiseconds are intentionally kept

        const timeParts = [
            [hours,   'hour'],
            [minutes, 'minute'],
            [seconds, 'second'],
        ];

        return timeParts
            .map(x => this.#getTimeTextPart(x[0], x[1], 2))
            .filter(x => x !== '') // prevent an extra space if a string is blank
            .join(' ');
    }

    /**
     * Convert the cutoff in centiseconds to a human-readable description of the cutoff. Must only be called if the round has a cutoff
     *
     * @param {number} attempts - Number of attempts for the cutoff
     * @param {number} totalCentisec - Cutoff duration in centiseconds
     * @returns {string} Human-readable cutoff, e.g. 'Continue if 1 or 2 < 1 minute 10 seconds'
     */
    #getCutoffText(attempts, totalCentisec) {
        let attemptsText = '';
        if (attempts === 1)
            attemptsText = '1';
        else if (attempts === 2)
            attemptsText = '1 or 2';
        else
            throw new Error(`attempts must be 1 or 2 (got ${attempts})`);

        const timeText = this.#getTimeText(totalCentisec);

        return `Continue if ${attemptsText} < ${timeText}`;
    }

    /**
     * Read the SCData object and set cutoff-related SCPDFData members
     *
     * @param {SCData} scData - SCData object
     */
    #setCutoffData(scData) {
        const totalAttempts = this.#formatToAttempts[scData.format];

        if (scData.cutoffCentisec !== null) {
            /* This round has a cutoff, so the cutoff needs to be printed on the scorecard. */
            this.attemptsPreCutoff = scData.cutoffAttempts;
            this.attemptsPostCutoff = totalAttempts - this.attemptsPreCutoff;
            this.cutoffText = this.#getCutoffText(scData.cutoffAttempts, scData.cutoffCentisec);
        } else if (this.#formatToCutoffAttempts[scData.format] !== null) {
            /* This round has no cutoff, but cutoffs are allowed for the event. 'Cutoff: N/A' text is needed on the scorecard where the cutoff would be. */
            this.attemptsPreCutoff = this.#formatToCutoffAttempts[scData.format];
            this.attemptsPostCutoff = totalAttempts - this.attemptsPreCutoff;
            this.cutoffText = 'N/A';
        } else {
            /* This round has no cutoff, and the event doesn't allow cutoffs. Don't include any cutoff text on the scorecard. */
            /* (The event could also be multiblind, but this software doesn't support cutoffs for multiblind.) */
            this.attemptsPreCutoff = totalAttempts;
            this.attemptsPostCutoff = null;
            this.cutoffText = null;
        }
    }

    /**
     * Generate text explaining which rounds share a cumulative time limit
     *
     * @param {CumulRoundInfo[]} cumulRoundInfos
     * @returns {string} e.g. ' for 4x4x4 Blindfolded and 5x5x5 Blindfolded'. Blank string if cumulRoundInfos.length < 2
     */
    #getCumulRoundText(cumulRoundInfos) {
        /* For size 1, we return a blank string because the cumulative time
         * limit is implied to be for the event on the scorecard if no other
         * events are listed.
         */
        if (cumulRoundInfos.length < 2)
            return '';

        const textArr =
            cumulRoundInfos
            .map(x => this.#getEventAndRoundText(x.eventName, x.round, x.numRounds));

        if (cumulRoundInfos.length === 2) {
            /* e.g. ' for 4x4x4 Blindfolded and 5x5x5 Blindfolded' */
            return ` for ${textArr.join(' and ')}`;
        }

        // cumulRoundInfos.length >= 3
        /* e.g. ', shared by 3 events' */
        return `, shared by ${cumulRoundInfos.length} events`;
    }

    /**
     * Read the SCData object and set time limit-related SCPDFData members
     *
     * @param {SCData} scData - SCData object
     */
    #setTimeLimitData(scData) {
        /*** Multi-blind: time limit text is always the same ***/
        if (scData.eventId === '333mbf') {
            this.timeLimitStartText = 'Time limit per solve';
            this.timeLimitEndText = '10 minutes per cube, up to 1 hour';
            return;
        }

        /*** All other events ***/

        /* Start text */
        if (scData.cumulRoundInfos.length === 0) {
            this.timeLimitStartText = 'Time limit per solve';
            this.timeLimitEndText =
                'DNF if ≥ ' +
                this.#getTimeText(scData.timeLimit);
        } else {
            this.timeLimitStartText = 'Cumulative time limit';
            this.timeLimitEndText =
                this.#getTimeText(scData.timeLimit) +
                this.#getCumulRoundText(scData.cumulRoundInfos);
        }
    }

    /**
     * Read the SCData object and set event-related SCPDFData members
     *
     * @param {SCData} scData - SCData object
     */
    #setEventData(scData) {
        this.#setEventAndRoundText(scData);
        this.#setCutoffData(scData);
        this.#setTimeLimitData(scData);
    }

    /**
     * Read the SCData object and set the group SCPDFData member
     *
     * @param {SCData} scData - SCData object
     */
    #setGroupData(scData) {
        this.group = `${scData.groupRoomAbbr}${scData.groupNum}`;
    }

    /**
     * Generate an SCPDFData object from an SCData object
     *
     * @param {SCData} scData - SCData object
     * @return {SCPDFData}
     */
    // TODO: we can probably just use the constructor tbh
    static fromScData(scData) {
        const scPdfData = new SCPDFData();

        scPdfData.type = scData.type;
        scPdfData.compName = scData.compName;

        switch (scData.type) {
            case SCType.competitor:
                scPdfData.#setCompetitorScData(scData);
                break;
            case SCType.roundBlank:
                scPdfData.#setRoundBlankScData(scData);
                break;
        }

        return scPdfData;
    }

    /**
     * Fill in SCPDFData object members for a competitor scorecard
     *
     * @param {SCData} scData - SCData object
     */
    #setCompetitorScData(scData) {
        this.#setPersonData(scData);
        this.#setEventData(scData);
        this.#setGroupData(scData);
    }

    /**
     * Fill in SCPDFData object members for a round-specific blank scorecard
     *
     * @param {SCData} scData - SCData object
     * @return {SCPDFData}
     */
    #setRoundBlankScData(scData) {
        this.#setEventData(scData);
    }
}

/**
 * Generate a list of SCPDFData objects for an event
 *
 * @param {WCIF} wcif - WCIF object
 * @param {Object<string, Option>} optionsObj - Map-like object that maps Option IDs to Option objects
 * @param {string} eventId - Event ID, e.g. '333'
 * @returns {SCPDFData[]}
 */
export function getScPdfDataForEvent(wcif, optionsObj, eventId) {
    return getScDataForEvent(wcif, optionsObj, eventId)
            .map(SCPDFData.fromScData);
}

/**
 * Draw horizontal and vertical cut lines through the page
 *
 * @param {jsPDF} doc - jsPDF object
 */
function drawCutLines(doc) {
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const xCenter = width / 2;
    const yCenter = height / 2;

    doc.setLineDashPattern([5, 6]);
    doc.setLineWidth(1.5);

    // Vertical line
    doc.line(xCenter, yCenter, xCenter, 0);
    doc.line(xCenter, yCenter, xCenter, height);

    // Horizontal line
    doc.line(xCenter, yCenter, 0, yCenter);
    doc.line(xCenter, yCenter, width, yCenter);

    /* Reset the line dash pattern and line width */
    doc.setLineDashPattern();
    doc.setLineWidth(1);
}


/* TODO: create a scorecard drawer that draws the following info:
 *
 * competition name
 * person id
 * event
 * group
 * person name (make sure names with accents work)
 * WCA ID
 * time limit (make sure Everything in Evanston time limit fits)
 * penalty example
 * pre-cutoff boxes
 * cutoff
 * post-cutoff boxes
 * extras
 */



/**
 * Return the horizontal center coordinate of a scorecard, assuming the coordinate of the top left of the scorecard is (0, 0).
 *
 * @param {jsPDF} doc - jsPDF object
 * @returns {number}
 */
function pdfGetScXCenter(doc) {
    return doc.internal.pageSize.getWidth() / 4;
}

/**
 * TODO: descripton
 * @param {number} amount - Quantity of vertical space to skip
 * @returns TODO
 */
function pdfSkip(amount) {
    return function(doc, scPdfData, x, y) {
        return amount;
    };
}

/** Write the title of the competition
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {SCPDFData} scPdfData - SCPDFData object
 * @param {number} x - Horizontal position
 * @param {number} y - Vertical position
 * @returns {number} - amount to update the vertical write position by (TODO: poorly worded)
 */
function pdfWriteCompetitionName(doc, scPdfData, x, y) {
    const fontSize = 10.5;

    // TODO: get font size/font and reset it
    doc.setFontSize(fontSize);
    doc.setFont('OpenSans', 'bold');

    const textOptions = {
        align: 'center',
    };

    doc.text(
        scPdfData.compName,
        x + pdfGetScXCenter(doc),
        y + fontSize,
        textOptions,
    );

    return fontSize;
}

/** Add a table that includes the competitor ID, event, round, and group
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {SCPDFData} scPdfData - SCPDFData object
 * @param {number} x - Horizontal position
 * @param {number} y - Vertical position
 * @returns {number} - amount to update the vertical write position by (TODO: poorly worded)
 */
function pdfAddHeaderTable(doc, scPdfData, x, y) {
    const head = [[
        'ID',
        'Event',
        'Group',
    ]];

    // For blank scorecard, some or all of these values are null
    const body = [[
        scPdfData.registrantId ?? '',
        scPdfData.eventAndRoundText ?? '',
        scPdfData.group ?? '',
    ]];

    const colWidths = [
        43,
        180,
        43,
    ];

    const columnStyles = {};
    for (let i = 0; i < colWidths.length; i++) {
        columnStyles[i] = { cellWidth: colWidths[i] };
    }

    // Total sum of colWidths
    const tableWidth = colWidths.reduce(
        (sum, x) => sum + x
    );

    const leftMargin = (doc.internal.pageSize.getWidth() / 2 - tableWidth) / 2;

    doc.autoTable({
        startY: y,
        margin: {
            top: 0,
            bottom: 0,
            left: x + leftMargin,
            right: 0,
        },
        head: head,
        body: body,
        theme: 'grid',

        columnStyles: columnStyles,

        styles: {
            font: 'OpenSans',
            fontSize: 10.5,
            textColor: [0, 0, 0], // black text
            lineColor: [0, 0, 0], // black lines
            lineWidth: 0.75,
            halign: 'center',
            valign: 'middle',
            cellPadding: 4,
        },

        headStyles: {
            fillColor: [200, 200, 200], // gray background
            fontStyle: 'bold',
            cellPadding: 3.5,
        },

        // Suppress spurious warning:
        // 'Of the table content, x units width could not fit page'
        tableWidth: 'wrap',
    })

    return doc.lastAutoTable.finalY - doc.lastAutoTable.settings.startY;
}

/**
 * Write the Roman-readable part of a competitor's name
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {SCPDFData} scPdfData - SCPDFData object
 * @param {number} x - Horizontal position
 * @param {number} y - Vertical position
 * @returns {number} - amount to update the vertical write position by (TODO: poorly worded)
 */
function pdfWritePersonName(doc, scPdfData, x, y) {
    const name = scPdfData.personNameRoman;
    const maxWidth = (doc.internal.pageSize.width / 2) - (textMargin * 2);
    const defaultSize = 26;
    let finalSize = defaultSize;

    // TODO: get font size/font and reset it
    doc.setFont('OpenSans', 'normal');

    // If needed, reduce the font size until the name fits on one line
    while (finalSize > 0) {
        doc.setFontSize(finalSize);
        if (doc.getTextWidth(name) <= maxWidth)
            break;

        finalSize -= 0.5;
    }

    if (finalSize === 0) {
        throw Error(`Reached font size of 0. Name string is too long: ${name}`);
    }

    // Now write the name of the competitor
    const textOptions = {
        align: 'center',
    };

    doc.text(
        name,
        x + pdfGetScXCenter(doc),
        y + finalSize,
        textOptions,
    );

    return finalSize;
}

/**
 * Write a competitor's WCA ID
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {SCPDFData} scPdfData - SCPDFData object
 * @param {number} x - Horizontal position
 * @param {number} y - Vertical position
 * @returns {number} - amount to update the vertical write position by (TODO: poorly worded)
 */
function pdfWriteWcaId(doc, scPdfData, x, y) {
    const fontSize = 16;

    // TODO: get font size/font and reset it
    doc.setFontSize(fontSize);
    doc.setFont('OpenSans', 'normal');

    const textOptions = {
        align: 'center',
    };

    doc.text(
        scPdfData.wcaId,
        x + pdfGetScXCenter(doc),
        y + fontSize,
        textOptions,
    );

    return fontSize;
}

/**
 * TODO: explain
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {string} boldText - Text to print in bold style
 * @param {string} regularText - Text to print in normal style
 * @returns {number} the index of the first character in regularText on the second line,
 *     OR the length of regularText if it all fits on one line
 */
function getNewlineIndex(doc, boldText, regularText) {
    // TODO: cache values based on argument
    const maxWidth = (doc.internal.pageSize.width / 2) - (textMargin * 2);

    let index = regularText.length;
    let totalWidth;

    for (index = regularText.length; index > 0; index--) {
        // We only want to split on space characters,
        // so don't waste CPU cycles checking the text size if this character isn't a space
        if (index < regularText.length && regularText[index] != ' ')
            continue

        // TODO: save and restore font
        // Get the total size of the first line
        totalWidth = 0;
        doc.setFont('OpenSans', 'bold');
        totalWidth += doc.getTextWidth(`${boldText}: `);
        doc.setFont('OpenSans', 'normal');
        totalWidth += doc.getTextWidth(
            regularText.slice(0, index)
        );

        // Two cases to return:
        // 1. All of the text fits on one line without any splitting
        // 2. We've found the space character at which to split the string into 2 lines
        if (totalWidth <= maxWidth)
            return index;
    }

    // index <= 0, which is a bug
    throw new Error(`Newline index is ${index} for this multiline text: '${boldText}: ${regularText}`);
}

/**
 * Write bold text, followed by a bold colon and space, followed by regular text
 *
 * Font size MUST be set by caller
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {number} x - Horizontal position
 * @param {number} y - Vertical position
 * @param {number} fontSize - Size of the font in points
 * @param {string} boldText - Text to print in bold style
 * @param {string} regularText - Text to print in normal style
 * @param {string} allowMultiline - Whether the text can be printed on 2 lines
 * @returns {number} - amount to update the vertical write position by (TODO: poorly worded)
 */
function pdfTextBoldAndRegular(doc, x, y, fontSize, boldText, regularText, allowMultiline=false) {
    let textHeight = fontSize;

    // TODO: get font size/font and reset it
    doc.setFontSize(fontSize);

    let line2Slice =
        allowMultiline ?
        getNewlineIndex(doc, boldText, regularText) : regularText.length;

    const textSegments = [
        { text: `${boldText}: `, style: 'bold' },
        { text: regularText.slice(0, line2Slice), style: 'normal' },
    ]

    let totalWidth = 0;
    for (const segment of textSegments) {
        doc.setFont('OpenSans', segment.style);
        segment.width = doc.getTextWidth(segment.text);
        totalWidth += segment.width;
    }

    let xLine1 = x +
        ((doc.internal.pageSize.getWidth() / 2 - totalWidth) / 2);

    for (const segment of textSegments) {
        doc.setFont('OpenSans', segment.style);
        doc.text(segment.text, xLine1, y + fontSize);
        xLine1 += segment.width;
    }

    // Print the second line if needed
    /* TODO: this needs to be tested more robustly, e.g. this breaks things:
     * '10 hours 30 minutes 45.55 seconds for 4x4x4 Blindfolded Final and 5x5x5 Blindfolded Final'.
     * maybe just fall back to the shared-by-multiple-events text if we overflow?
     * we could pass the number of cumulative rounds from scPdfData to dynamically generate this string
     */
    if (allowMultiline && line2Slice !== regularText.length) {
        const textOptions = { align: 'center' };
        const whitespace = 1;

        doc.setFont('OpenSans', 'normal');
        doc.text(
            // Add 1 to skip the space
            regularText.slice(line2Slice + 1),
            x + (doc.internal.pageSize.getWidth() / 4),
            y + whitespace + (fontSize * 2),
            textOptions,
        );

        textHeight += fontSize + whitespace;
    }

    return textHeight;
}

// TODO: some cumulative time limits are multi-line. deal with this
/**
 * Write the time limit for the event
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {SCPDFData} scPdfData - SCPDFData object
 * @param {number} x - Horizontal position
 * @param {number} y - Vertical position
 * @returns {number} - amount to update the vertical write position by (TODO: poorly worded)
 */
function pdfWriteTimeLimit(doc, scPdfData, x, y) {
    const fontSize = 10;

    return pdfTextBoldAndRegular(
        doc,
        x,
        y,
        fontSize,
        scPdfData.timeLimitStartText,
        scPdfData.timeLimitEndText,
        true,
    );
}

/**
 * Write an example of how a penalty should be written
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {SCPDFData} scPdfData - SCPDFData object
 * @param {number} x - Horizontal position
 * @param {number} y - Vertical position
 * @returns {number} - amount to update the vertical write position by (TODO: poorly worded)
 */
function pdfWritePenaltyExample(doc, scPdfData, x, y) {
    const fontSize = 10.5;

    return pdfTextBoldAndRegular(
        doc,
        x,
        y,
        fontSize,
        'Penalty example',
        '4.25 + 2 = 6.25',
    );
}

/* Constants for attempt tables */
const attemptLineWidth = 0.75;
const attemptFontSize = 10;
const attemptCellPadding = 5;
const attemptColWidths = [25, 25, 166, 25, 25];

/**
 * Add table entries for the given attempts
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {number} x - Horizontal position
 * @param {number} y - Vertical position
 * @param {number} startAttempt - number of the first attempt
 * @param {number} endAttempt - number of the final attempt (exclusive)
 * @param {boolean} extras - whether or not to print the attempts as extras (i.e., attempt numbers are prefixed by 'E')
 */
function pdfAddAttempts(doc, x, y, startAttempt, endAttempt, extras = false) {
    const body = [];
    let attemptText;
    for (let i = startAttempt; i <= endAttempt; i++) {
        attemptText = extras ? `E${i}` : i;
        body.push([attemptText, ...Array(4).fill('')]);
    }

    // TODO: make this a function
    const columnStyles = {};
    for (let i = 0; i < attemptColWidths.length; i++) {
        columnStyles[i] = { cellWidth: attemptColWidths[i] };
    }

    // Total sum of attemptColWidths
    // TODO: make this a function
    const tableWidth = attemptColWidths.reduce(
        (sum, x) => sum + x
    );

    const leftMargin = (doc.internal.pageSize.getWidth() / 2 - tableWidth) / 2;

    doc.autoTable({
        startY: y,
        margin: {
            top: 0,
            bottom: 0,
            left: x + leftMargin,
            right: 0,
        },
        body: body,
        theme: 'grid',

        columnStyles: columnStyles,

        styles: {
            font: 'OpenSans',
            fontSize: attemptFontSize,
            fontStyle: 'bold',
            textColor: [0, 0, 0], // black text
            lineColor: [0, 0, 0], // black lines
            lineWidth: attemptLineWidth,
            halign: 'center',
            valign: 'middle',
            cellPadding: attemptCellPadding,
        },

        // Suppress spurious warning:
        // 'Of the table content, x units width could not fit page'
        tableWidth: 'wrap',
    })

    return doc.lastAutoTable.finalY - doc.lastAutoTable.settings.startY;
}

/**
 * Add a table for the attempts before the cutoff (all attempts if the cutoff doesn't exist)
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {SCPDFData} scPdfData - SCPDFData object
 * @param {number} x - Horizontal position
 * @param {number} y - Vertical position
 * @returns {number} - amount to update the vertical write position by (TODO: poorly worded)
 */
function pdfAddPreCutoffAttempts(doc, scPdfData, x, y) {
    // Draw 1 table for the header and 1 for the body (i.e. the actual attempts)
    const header = [[ '#', 'S', 'Result', 'J', 'C' ]];

    const columnStyles = {};
    for (let i = 0; i < attemptColWidths.length; i++) {
        columnStyles[i] = { cellWidth: attemptColWidths[i] };
    }

    // Total sum of attemptColWidths
    const tableWidth = attemptColWidths.reduce(
        (sum, x) => sum + x
    );

    const leftMargin = (doc.internal.pageSize.getWidth() / 2 - tableWidth) / 2;

    doc.autoTable({
        startY: y,
        margin: {
            top: 0,
            bottom: 0,
            left: x + leftMargin,
            right: 0,
        },
        // Need to use body here instead of head, because jspdf-autotable doesn't
        // size the columns properly if a table has only a head and no body.
        body: header,
        theme: 'grid',

        columnStyles: columnStyles,
        tableWidth: 'fixed',

        styles: {
            font: 'OpenSans',
            fontSize: attemptFontSize,
            fontStyle: 'bold',
            textColor: [0, 0, 0], // black text
            lineColor: [0, 0, 0], // black lines
            lineWidth: attemptLineWidth,
            halign: 'center',
            valign: 'middle',
            cellPadding: 3.5,
            fillColor: [200, 200, 200], // gray background
        },

        // Suppress spurious warning:
        // 'Of the table content, x units width could not fit page'
        tableWidth: 'wrap',
    })

    // Now draw the body of the table (i.e. the actual attempts)
    const headHeight = doc.lastAutoTable.finalY - doc.lastAutoTable.settings.startY;
    const bodyHeight = pdfAddAttempts(doc, x, y + headHeight, 1, scPdfData.attemptsPreCutoff);

    return headHeight + bodyHeight;
}

/**
 * Write the cutoff if the event supports cutoffs
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {SCPDFData} scPdfData - SCPDFData object
 * @param {number} x - Horizontal position
 * @param {number} y - Vertical position
 * @returns {number} - amount to update the vertical write position by (TODO: poorly worded)
 */
function pdfWriteCutoff(doc, scPdfData, x, y) {
    // Don't write anything for events that don't support cutoffs
    if (scPdfData.cutoffText === null)
        return 0;

    // Whitespace above and below the cutoff text
    const yPadding = 4;
    const fontSize = 10;

    let textHeight = pdfTextBoldAndRegular(
        doc,
        x,
        y + yPadding,
        fontSize,
        'Cutoff',
        scPdfData.cutoffText,
    );

    return textHeight + (yPadding * 2);
}

/**
 * Add a table for the attempts after the cutoff, if a cutoff exists
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {SCPDFData} scPdfData - SCPDFData object
 * @param {number} x - Horizontal position
 * @param {number} y - Vertical position
 * @returns {number} - amount to update the vertical write position by (TODO: poorly worded)
 */
function pdfAddPostCutoffAttempts(doc, scPdfData, x, y) {
    // Draw nothing if the event doesn't support cutoffs (i.e., we've already added all the attempts)
    if (scPdfData.attemptsPostCutoff === null)
        return 0;

    return pdfAddAttempts(
        doc,
        x,
        y,
        scPdfData.attemptsPreCutoff + 1,
        scPdfData.attemptsPreCutoff + scPdfData.attemptsPostCutoff,
    );
}

/**
 * Add a header for the extra attempts
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {SCPDFData} scPdfData - SCPDFData object
 * @param {number} x - Horizontal position
 * @param {number} y - Vertical position
 * @returns {number} - amount to update the vertical write position by (TODO: poorly worded)
 */
function pdfWriteExtrasHeader(doc, scPdfData, x, y) {
    const fontSize = 10;

    // TODO: get font size/font and reset it
    doc.setFontSize(fontSize);
    doc.setFont('OpenSans', 'bold');

    const textOptions = {
        align: 'center',
    };

    doc.text(
        'Extras',
        x + pdfGetScXCenter(doc),
        y + fontSize,
        textOptions,
    );

    return fontSize;
}

/**
 * Add a table for extra attempts
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {SCPDFData} scPdfData - SCPDFData object
 * @param {number} x - Horizontal position
 * @param {number} y - Vertical position
 * @returns {number} - amount to update the vertical write position by (TODO: poorly worded)
 */
function pdfAddExtraAttempts(doc, scPdfData, x, y) {
    const body = [];
    let attemptText;
    for (let i = 1; i <= 2; i++) {
        attemptText = `E${i}`;
        body.push([attemptText,
            '',
            '',
            'D',
            '',
            '',
        ]);
    }

    const extraColWidths = [25, 25, 141, 25, 25, 25];

    // TODO: make this a function
    const columnStyles = {};
    for (let i = 0; i < extraColWidths.length; i++) {
        columnStyles[i] = { cellWidth: extraColWidths[i] };
    }

    // Make the delegate signature spot light gray
    columnStyles[3].textColor = [ 211, 211, 211 ];
    columnStyles[3].fontSize = 14;

    // Total sum of extraColWidths
    // TODO: make this a function
    const tableWidth = extraColWidths.reduce(
        (sum, x) => sum + x
    );

    const leftMargin = (doc.internal.pageSize.getWidth() / 2 - tableWidth) / 2;

    doc.autoTable({
        startY: y,
        margin: {
            top: 0,
            bottom: 0,
            left: x + leftMargin,
            right: 0,
        },
        body: body,
        theme: 'grid',

        columnStyles: columnStyles,

        styles: {
            font: 'OpenSans',
            fontSize: attemptFontSize,
            fontStyle: 'bold',
            textColor: [0, 0, 0], // black text
            lineColor: [0, 0, 0], // black lines
            lineWidth: attemptLineWidth,
            halign: 'center',
            valign: 'middle',
            cellPadding: attemptCellPadding,
        },

        // Suppress spurious warning:
        // 'Of the table content, x units width could not fit page'
        tableWidth: 'wrap',
    })

    return doc.lastAutoTable.finalY - doc.lastAutoTable.settings.startY;
}

/**
 * Draw a single scorecard for a competitor
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {SCPDFData} scPdfData - SCPDFData object
 * @param {number} x - Horizontal position of top-left corner of scorecard
 * @param {number} y - Vertical position of top-left corner of scorecard
 */
function drawCompetitorScorecard(doc, scPdfData, x, y) {
    const funcs = [
        pdfSkip(21),
        pdfWriteCompetitionName,
        pdfSkip(7),
        pdfAddHeaderTable,
        pdfSkip(4),
        pdfWritePersonName,
        pdfSkip(5),
        pdfWriteWcaId,
        pdfSkip(7),
        pdfWriteTimeLimit,
        pdfSkip(2),
        pdfWritePenaltyExample,
        pdfSkip(7),
        pdfAddPreCutoffAttempts,
        pdfWriteCutoff,
        pdfAddPostCutoffAttempts,
        pdfSkip(2),
        pdfWriteExtrasHeader,
        pdfSkip(2),
        pdfAddExtraAttempts,
    ];

    for (const func of funcs) {
        y += func(doc, scPdfData, x, y);
    }
}

/**
 * Draw a single round-specific blank scorecard
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {SCPDFData} scPdfData - SCPDFData object
 * @param {number} x - Horizontal position of top-left corner of scorecard
 * @param {number} y - Vertical position of top-left corner of scorecard
 */
function drawRoundBlankScorecard(doc, scPdfData, x, y) {
    const funcs = [
        pdfSkip(21),
        pdfWriteCompetitionName,
        pdfSkip(7),
        pdfAddHeaderTable,
        // Leave enough space to write the name and WCA ID
        pdfSkip(58),
        pdfWriteTimeLimit,
        pdfSkip(2),
        pdfWritePenaltyExample,
        pdfSkip(7),
        pdfAddPreCutoffAttempts,
        pdfWriteCutoff,
        pdfAddPostCutoffAttempts,
        pdfSkip(2),
        pdfWriteExtrasHeader,
        pdfSkip(2),
        pdfAddExtraAttempts,
    ];

    for (const func of funcs) {
        y += func(doc, scPdfData, x, y);
    }
}

/**
 * Draw a single scorecard corresponding to the SCPDFData object
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {SCPDFData} scPdfData - SCPDFData object
 * @param {number} x - Horizontal position of top-left corner of scorecard
 * @param {number} y - Vertical position of top-left corner of scorecard
 */
function drawScorecard(doc, scPdfData, x, y) {
    const typeToFunc = {
        [SCType.competitor]: drawCompetitorScorecard,
        [SCType.roundBlank]: drawRoundBlankScorecard,
    };

    typeToFunc[scPdfData.type](doc, scPdfData, x, y);
}

/**
 * Parse an array of SCPDFData objects and draw up to 4 scorecards on the given document
 *
 * @param {jsPDF} doc - jsPDF object
 * @param {SCPDFData[]} scPdfSubset - array of 4 SCPDFData objects
 */
function draw4Scorecards(doc, scPdfSubset) {
    /* Ideally, length of scPdfSubset is exactly 4, with blank scorecards at the end if needed */
    if (scPdfSubset.length < 4) {
        const eventAndRound = scPdfSubset[0].eventAndRoundText;
        console.log(`Warning: ${eventAndRound}: length of scPdfSubset is ${scPdfSubset.length} instead of 4. Did you mean to add blank scorecards to the end?`)
    } else if (scPdfSubset.length > 4) {
        throw Error(`Length of scPdfSubset is ${scPdfSubset.length} (must be <= 4)`);
    }

    const xCenter = doc.internal.pageSize.getWidth() / 2;
    const yCenter = doc.internal.pageSize.getHeight() / 2;

    /* (x, y) coordinates coordinates corresponding to a
     * scorecard position in a 2x2 grid
     */
    const coords = [
        [0,       0],
        [xCenter, 0],
        [0,       yCenter],
        [xCenter, yCenter],
    ];

    for (let i = 0; i < scPdfSubset.length; i++) {
        let [x, y] = coords[i];

        drawScorecard(doc, scPdfSubset[i], x, y);
    }
}

/**
 * Generate a scorecard PDF for the given event
 *
 * @param {WCIF} wcif - WCIF object
 * @param {Object<string, Option>} optionsObj - Map-like object that maps Option IDs to Option objects
 * @param {string} eventId - Event ID, e.g. '333'
 */
function genScPdfEvent(wcif, optionsObj, eventId) {
    const scPdfArr = getScPdfDataForEvent(wcif, optionsObj, eventId);

    /* TODO: move this to its own function */
    const pdfFormat = 'letter';
    const doc = new jsPDF(
        {
            unit: 'pt',
            format: pdfFormat,
        }
    );

    /* Add all the pages that will be needed. Note that the first page was made when the jsPDF object was made */
    for (let i = 0; i < (scPdfArr.length / 4) - 1; i++) {
        doc.addPage(pdfFormat);
    }

    let scPdfSubset;
    for (let i = 0; i < scPdfArr.length / 4; i++) {
        /* jsPDF pages are 1-indexed */
        doc.setPage(i + 1);
        drawCutLines(doc);

        scPdfSubset = scPdfArr.slice(i * 4, (i + 1) * 4);
        draw4Scorecards(doc, scPdfSubset);
    }

    const eventName = WCIF.eventIdToName[eventId].replaceAll(' ', '_');
    doc.save(`${wcif.compId}_${eventName}.pdf`);
}

/**
 * Generate scorecard PDFs for all events for the given WCIF
 *
 * @param {WCIF} wcif - WCIF object
 * @param {Object<string, Option>} optionsObj - Map-like object that maps Option IDs to Option objects
 */
export function genScPdfsFromWcif(wcif, optionsObj) {
    for (const eventId of wcif.getEventIds()) {
        genScPdfEvent(wcif, optionsObj, eventId);
    }
}

/**
 * Generate scorecard PDFs for all events for the given competition ID
 *
 * @param {compId} - Competition ID, e.g. WesternChampionship2026
 * @param {Object<string, Option>} optionsObj - Map-like object that maps Option IDs to Option objects
 */
// TODO: unused?
export async function genScPdfs(compId, optionsObj) {
    const wcif = await WCIF.fromCompId(compId);

    genScPdfsFromWcif(wcif, optionsObj);
}