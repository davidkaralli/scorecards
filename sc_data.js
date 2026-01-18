/**
 * @module sc_data
 * @description All the data needed to generate a scorecard
 * @author David Karalli
 */

import { WCIF } from './wcif.js';

export class CumulRoundInfo {
    /**
     * Event ID, e.g. '333'
     * @type {string}
     */
    eventId;
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
    /** @type {number} */
    registrantId;
    /** @type {string | null} */
    wcaId;
    /** @type {string} */
    personName;

    /*** Event data ***/
    /**
     * Event ID, e.g. '333'
     * @type {string}
     */
    eventId;
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

        scData.compName = wcif.getCompName();

        /* Person data */
        scData.registrantId = registrantId;
        scData.wcaId = wcif.getWcaId(registrantId);
        scData.personName = wcif.getPersonName(registrantId);

        /* Event data */
        scData.eventId = eventId;
        scData.round = round;
        scData.numRounds = wcif.getNumRounds(eventId);
        scData.format = wcif.getFormat(eventId, round);
        scData.cutoffCentisec = wcif.getCutoffCentisec(eventId, round);
        scData.cutoffAttempts = wcif.getCutoffAttempts(eventId, round);
        scData.timeLimit = wcif.getTimeLimit(eventId, round);

        scData.cumulRoundInfos =
            wcif
                .getCumulRoundIds(eventId, round)
                .map(roundId => new CumulRoundInfo(wcif, roundId));

        scData.groupNum = wcif.getGroupNum(actId);
        scData.groupRoom = wcif.getGroupRoom(actId);
        scData.numRooms = wcif.getNumRooms();

        return scData;
    }

    // TODO: blankScData
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
 * @param {string} eventId - Event ID, e.g. '333'
 * @param {number} round - Round number
 * @returns {SCData[]}
 */
export function getScDataForRound(wcif, eventId, round) {
    return wcif.getGroupActIds(eventId, round)
        .flatMap(actId => getScDataForGroup(wcif, eventId, round, actId));
}

/**
 * Generate a list of SCData objects for an event
 *
 * @param {WCIF} wcif - WCIF object
 * @param {string} eventId - Event ID, e.g. '333'
 * @returns {SCData[]}
 */
export function getScDataForEvent(wcif, eventId) {
    const numRounds = wcif.getNumRounds(eventId);

    let sc_data_arr = [];

    for (let round = 1; round <= numRounds; round++) {
        sc_data_arr = sc_data_arr.concat(getScDataForRound(wcif, eventId, round));
    }

    return sc_data_arr;
}

function getScDataForFormatBlanks(format) {

}

// TODO: sorting functions