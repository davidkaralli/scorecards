/**
 * @module sc_data
 * @description All the data needed to generate a scorecard
 * @author David Karalli
 */

import { WCIF } from './wcif.js';
import { Option, RoundBlanksOption } from './options.js'

/**
 * Enum for scorecard types
 */
export const SCType = Object.freeze({
    /* Fully filled-out scorecard, i.e. with competitor-specific information */
    competitor  : Symbol('competitor'),
    /* Partially filled-out scorecard, with information about a given round, but not assigned to a competitor */
    roundBlank  : Symbol('roundBlank'),
    /* Barely filled-out scorecard, with the structure being determined by the format */
    formatBlank : Symbol('formatBlank'),
});

export class CumulRoundInfo {
    /**
     * Event ID, e.g. '333'
     * @type {string}
     */
    eventId;
    /**
     * Human-readable event name, e.g. '3x3x3 Cube'
     * @type {string}
     */
    eventName;
    /** @type {number} */
    round;
    /**
     * Number of rounds for the event; needed to distinguish e.g. 'Round 1' vs. 'Final'
     * @type {number}
     */
    numRounds;

    /**
     * @constructor
     * @param {WCIF} wcif - WCIF object
     * @param {string} roundId - Round ID, e.g. '333-r1'
     */
    constructor(wcif, roundId) {
        this.eventId = WCIF.getEventIdFromRoundId(roundId);
        this.eventName = WCIF.eventIdToName[this.eventId];
        this.round = WCIF.getRoundFromRoundId(roundId);
        this.numRounds = wcif.getNumRounds(this.eventId)
    }
}

export class SCData {
    /**
     * Name of the competition
     * @type {string}
     */
    compName;

    /*** Person data ***/
    /* Unless otherwise noted, null types indicate that the entry is not present on a blank scorecard */
    /** @type {number | null} */
    registrantId;
    /** @type {bool | null} */
    newCompetitor;
    /**
     * If newCompetitor is true, a null value for wcaId indicates a new competitor.
     *
     * If newCompetitor is null, wcaId will also be null, with "null"s corresponding to a blank scorecard.
     *
     * @type {string | null} */
    wcaId;
    /** @type {string | null} */
    personName;

    /*** Event data ***/
    /**
     * Event ID, e.g. '333'
     * @type {string}
     */
    eventId;
    /**
     * Human-readable event name, e.g. '3x3x3 Cube'
     * @type {string}
     */
    eventName;
    /** @type {number} */
    round;
    /**
     * Number of rounds for the event; needed to distinguish e.g. 'Round 1' vs. 'Final'
     * @type {number}
     */
    numRounds;
    /**
     * Format of the round, e.g. 'a' or '3'
     * @type {string}
     */
    format;
    /**
     * Cutoff duration in centiseconds, or null if no cutoff exists
     * @type {number | null}
     */
    cutoffCentisec;
    /**
     * Number of attempts for the cutoff, or null if no cutoff exists
     * @type {number | null}
     */
    cutoffAttempts;
    /**
     * Time limit in centiseconds; null for MBLD
     * @type {number | null}
     */
    timeLimit; // centiseconds
    /**
     * Information about rounds with shared cumulative time limits; empty array if no such round exists.
     * @type {CumulRoundInfo[]}
     */
    cumulRoundInfos; // centiseconds

    /*** Group data ***/
    /** @type {number} */
    groupNum;
    /** @type {string} */
    groupRoom;
    /**
     * Number of rooms in the WCIF JSON
     * @type {number}
     */
    numRooms;

    /**
     * What kind of scorecard the data is for
     * @type {Symbol}
     */
    type;

    /**
     * Generate a scorecard for a given competitor (as opposed to a blank scorecard)
     *
     * @param {WCIF} wcif - WCIF object
     * @param {string} eventId - Event ID, e.g. '333'
     * @param {number} round - Round number
     * @param {number} actId - Activity ID
     * @param {number} registrantId - Registrant ID
     * @returns {SCData}
     */
    static competitorScData(wcif, eventId, round, actId, registrantId) {
        const scData = new SCData;

        scData.type = SCType.competitor;

        scData.compName = wcif.getCompName();

        /* Person data */
        scData.registrantId = registrantId;
        scData.newCompetitor = wcif.isNewCompetitor(registrantId);
        scData.wcaId = wcif.getWcaId(registrantId);
        scData.personName = wcif.getPersonName(registrantId);

        /* Event data */
        scData.eventId = eventId;
        scData.eventName = WCIF.eventIdToName[eventId];
        scData.round = round;
        scData.numRounds = wcif.getNumRounds(eventId);
        scData.format = wcif.getFormat(eventId, round);
        scData.cutoffCentisec = wcif.getCutoffCentisec(eventId, round);
        scData.cutoffAttempts = wcif.getCutoffAttempts(eventId, round);
        scData.timeLimit = wcif.getTimeLimit(eventId, round);

        scData.cumulRoundInfos =
            wcif.getCumulRoundIds(eventId, round)
                .map(roundId => new CumulRoundInfo(wcif, roundId));

        scData.groupNum = wcif.getGroupNum(actId);
        scData.groupRoom = wcif.getGroupRoom(actId);
        scData.numRooms = wcif.getNumRooms();

        return scData;
    }

    /**
     * Generate a blank scorecard corresponding to a given round
     *
     * @param {WCIF} wcif - WCIF object
     * @param {string} eventId - Event ID, e.g. '333'
     * @param {number} round - Round number
     * @returns {SCData}
     */
    static roundBlankScData(wcif, eventId, round) {
        const scData = new SCData;

        scData.type = SCType.roundBlank;

        scData.compName = wcif.getCompName();

        /* Person data */
        scData.registrantId = null;
        scData.newCompetitor = null;
        scData.wcaId = null;
        scData.personName = null;

        /* Event data */
        scData.eventId = eventId;
        scData.eventName = WCIF.eventIdToName[eventId];
        scData.round = round;
        scData.numRounds = wcif.getNumRounds(eventId);
        scData.format = wcif.getFormat(eventId, round);
        scData.cutoffCentisec = wcif.getCutoffCentisec(eventId, round);
        scData.cutoffAttempts = wcif.getCutoffAttempts(eventId, round);
        scData.timeLimit = wcif.getTimeLimit(eventId, round);

        scData.cumulRoundInfos =
            wcif.getCumulRoundIds(eventId, round)
                .map(roundId => new CumulRoundInfo(wcif, roundId));

        scData.groupNum = null;
        scData.groupRoom = null;
        scData.numRooms = null;

        return scData;
    }
}

/**
 * Generate a list of SCData objects for a group from its activity ID
 *
 * @param {WCIF} wcif - WCIF object
 * @param {string} eventId - Event ID, e.g. '333'
 * @param {number} round - Round number
 * @param {number} actId - Activity ID
 * @returns {SCData[]}
 */
function getScDataForGroup(wcif, eventId, round, actId) {
    /* Note: strictly speaking, passing the event ID and round number is unnecessary;
     * however, this function is only called by other functions that already
     * have the event ID and round. Passing these values is an intentional
     * choice to avoid the complexity of getting the event ID and round from
     * the activity ID.
     */

    return wcif.getCompetitorsFromActId(actId)
        .map(registrantId => SCData.competitorScData(wcif, eventId, round, actId, registrantId));
}

/**
 * Generate a list of SCData objects for a round
 *
 * @param {WCIF} wcif - WCIF object
 * @param {Object<string, Option>} optionsObj - Map-like object that maps Option IDs to Option objects
 * @param {string} eventId - Event ID, e.g. '333'
 * @param {number} round - Round number
 * @returns {SCData[]}
 */
export function getScDataForRound(wcif, optionsObj, eventId, round) {
    /* Non-blank (competitor-specific) scorecards */
    const scDataArr =
        wcif.getGroupActIds(eventId, round)
        .flatMap(actId => getScDataForGroup(wcif, eventId, round, actId));

    /* Add blank scorecards */
    scDataArr.push(...getScDataForRoundBlanks(wcif, optionsObj, eventId, round));

    return scDataArr;
}

/**
 * Generate a list of SCData objects for an event
 *
 * @param {WCIF} wcif - WCIF object
 * @param {Object<string, Option>} optionsObj - Map-like object that maps Option IDs to Option objects
 * @param {string} eventId - Event ID, e.g. '333'
 * @returns {SCData[]}
 */
export function getScDataForEvent(wcif, optionsObj, eventId) {
    const numRounds = wcif.getNumRounds(eventId);

    let scDataArr = [];

    for (let round = 1; round <= numRounds; round++) {
        scDataArr = scDataArr.concat(getScDataForRound(wcif, optionsObj, eventId, round));
    }

    return scDataArr;
}

/* Blank scorecards */


function getScDataForFormatBlanks(format) {

}

/**
 * Generate a list of SCData objects representing blank scorecards for a round
 *
 * @param {WCIF} wcif - WCIF object
 * @param {Object<string, Option>} optionsObj - Map-like object that maps Option IDs to Option objects
 * @param {string} eventId - Event ID, e.g. '333'
 * @param {number} round - Round number
 * @returns {SCData[]}
 */
export function getScDataForRoundBlanks(wcif, optionsObj, eventId, round) {
    const id = RoundBlanksOption.genId(eventId, round);
    const option = optionsObj[id];
    const scPerPage = 4;

    // Blanks to fill in the remaining entries of a page, if applicable
    let numFillerBlanks;
    if (wcif.groupsAreAssigned(eventId, round)) {
        const numCompetitors = wcif.getNumAdvancingToRound(eventId, round);
        numFillerBlanks = scPerPage - (numCompetitors % scPerPage);
    } else {
        // No groups have been assigned; no need to add filler blanks
        numFillerBlanks = 0;
    }

    // TODO: warn when the user doesn't provide enough blanks for a round? e.g. 1 page of blanks for a 12-round final
    const numBlanks = numFillerBlanks
        + (option.value * scPerPage);

    return Array(Number(numBlanks))
        .fill(
            SCData.roundBlankScData(wcif, eventId, round)
        );
}

// TODO: sorting functions