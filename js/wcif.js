/**
 * @module wcif
 * @description Operations for parsing WCIF data
 * @author David Karalli
 */

/* TODO: provide the following information:
   - Competition name
   - Competition round/events list
   - Competitors
   - Competitor names
   - Competitor IDs
   - Competitor WCA IDs
   - Groups
   - Time limit
   - Cutoffs
   - Formats
*/

export class WCIF {
	/* Competition ID, e.g. 'WesternChampionship2025' */
	compId;

   /* Private members */
	/* Data from JSON */
	#data;
   /* Arrays from the JSON */
   #eventsArr;
   #personsArr;


   /**
    * @constructor
    * @param {string} compId - Competition ID, e.g. 'WesternChampionship2026'
    * @param {object} data - Object generated from WCIF JSON
    * @returns {WCIF}
    */
	constructor(compId, data) {
      this.compId = compId;

      this.#data = data;

      this.name = this.#data.name;

      this.#eventsArr = this.#data.events;
      this.#personsArr = this.#data.persons;
	}

   /**
    * Get the name of the competition (e.g. 'Western Championship 2026')
    *
    * @returns {string}
    */
   getCompName() {
      return this.#data.name;
   }

   /**
    * Get a list of events for the competition
    *
    * Excludes 3x3x3 Fewest Moves since this software doesn't support it
    *
    * @returns {string[]}
    */
   getEventIds() {
      return this.#eventsArr
         .map(x => x.id)
         .filter(x => x !== '333fm');
   }

    /**
     * Map-like object that converts event IDs (like '333') to event names (like '3x3x3 Cube')
     * @type {Object.<string, string>}
     */
    static eventIdToName = {
        '333': '3x3x3 Cube',
        '222': '2x2x2 Cube',
        '444': '4x4x4 Cube',
        '555': '5x5x5 Cube',
        '666': '6x6x6 Cube',
        '777': '7x7x7 Cube',
        '333bf': '3x3x3 Blindfolded',
        '333fm': '3x3x3 Fewest Moves',
        '333oh': '3x3x3 One-Handed',
        'clock': 'Clock',
        'minx': 'Megaminx',
        'pyram': 'Pyraminx',
        'skewb': 'Skewb',
        'sq1': 'Square-1',
        '444bf': '4x4x4 Blindfolded',
        '555bf': '5x5x5 Blindfolded',
        '333mbf': '3x3x3 Multi-Blind',
    };

    /**
     * Map-like object that converts event IDs (like '333') to shortened event names (like '3x3')
     * @type {Object.<string, string>}
     */
    static eventIdToShortName = {
        '333': '3x3',
        '222': '2x2',
        '444': '4x4',
        '555': '5x5',
        '666': '6x6',
        '777': '7x7',
        '333bf': '3x3 Blind',
        '333fm': 'FMC',
        '333oh': '3x3 OH',
        'clock': 'Clock',
        'minx': 'Megaminx',
        'pyram': 'Pyraminx',
        'skewb': 'Skewb',
        'sq1': 'Square-1',
        '444bf': '4x4 Blind',
        '555bf': '5x5 Blind',
        '333mbf': 'Multi-Blind',
    };


   /**
    * Get the JSON object for the given event
    *
    * @param {string} eventId - Event ID, e.g. '333'
    * @returns {object}
    */
   #getEventObj(eventId) {
      return this.#eventsArr.find(x => x.id === eventId);
   }

   /**
    * Get the JSON object for the given round
    *
    * @param {string} eventId - Event ID, e.g. '333'
    * @param {number} round - Round number
    *
    * @returns {object}
    */
   #getRoundObj(eventId, round) {
      const eventObj = this.#getEventObj(eventId);

      return eventObj.rounds.find(x => x.id === `${eventId}-r${round}`);
   }

   /**
    * Get the number of a round from its ID
    *
    * @param {string} roundId - Round ID, e.g. '333-r1'
    * @returns {number}
    */
   static getRoundFromRoundId(roundId) {
      return Number(roundId.split('-r')[1]);
   }

   /**
    * Get the event ID corresponding to a round ID
    *
    * @param {string} roundId - Round ID, e.g. '333-r1'
    * @returns {string}
    */
   static getEventIdFromRoundId(roundId) {
      return roundId.split('-r')[0];
   }

   /**
    * Get the activity code from the event ID and round number
    *
    * MULTIBLIND: provide the activity code for the first attempt, as this is all that's needed to determine who's competing in the round
    *
    * @param {string} eventId - Event ID, e.g. '333'
    * @param {number} round - Round number, e.g. 1
    * @return {string} Activity code, e.g. '333-r1' or '333mbf-r1-a1'
    */
   #getActCode(eventId, round) {
      if (eventId === '333mbf')
         return `${eventId}-r${round}-a1`;

      return `${eventId}-r${round}`;
   }

   /**
    * Get the number of rounds for the given event
    *
    * @param {string} eventId - Event ID, e.g. '333'
    * @returns {number}
    */
   getNumRounds(eventId) {
      const eventObj = this.#getEventObj(eventId);

      return eventObj.rounds.length;
   }

   /**
    * Get the room objects from the WCIF JSON
    *
    * @returns {object[]} List of room objects
    */
   #getRoomObjs() {
      const venues = this.#data.schedule.venues;

      return venues.flatMap(x => x.rooms);
   }

   /**
    * Get the names of the rooms from the WCIF JSON
    *
    * @returns {string[]} List of room names
    */
   getRoomNames() {
      return this.#getRoomObjs()
         .map(x => x.name);
   }

   /**
    * Get the number of rooms in the WCIF JSON
    *
    * @returns {number}
    */
   getNumRooms() {
      return this.#getRoomObjs().length;
   }

   /**
    * Get the top-level activity objects for each room (i.e., all activities that aren't children of activities)
    *
    * @returns {object[]}
    */
   #getTopLevelActObjs() {
      const roomObjs = this.#getRoomObjs();

      return roomObjs.flatMap(x => x.activities);
   }

   /**
    * Get the activity IDs for each group of a round of an event
    *
    * @param {string} eventId - Event ID, e.g. '333'
    * @param {number} round - Round number, e.g. 1
    * @returns {number[]}
    */
   getGroupActIds(eventId, round) {
      const roundId = this.#getActCode(eventId, round);
      const actObjs = this.#getTopLevelActObjs();

      return actObjs
         .filter(x => x.activityCode === roundId)
         .flatMap(x => x.childActivities)
         .map(x => x.id);
   }

   /**
    * Get all of the activity objects corresponding to a group of a round.
    *
    * @returns {object[]}
    */
   #getGroupActObjs() {
      const actObjs = this.#getTopLevelActObjs();

      return actObjs.flatMap(x => x.childActivities);
   }

   /**
    * Get the list of registrant IDs of all competitors competing in a group
    *
    * @param {number} actId - Activity ID, e.g. 1
    * @returns {number[]}
    */
   getCompetitorsFromActId(actId) {
      function competingInAct(personObj) {
         return personObj.assignments.some(x => x.activityId === actId && x.assignmentCode === 'competitor');
      }

      return this.#personsArr
         .filter(competingInAct)
         .map(x => x.registrantId);
   }

   /**
    * Get the number of the group corresponding to the given activity ID
    *
    * @param {number} actId
    * @returns {number}
    */
   getGroupNum(actId) {
      const actCode = this.#getGroupActObjs()
         .find(x => x.id === actId)
         .activityCode;

      /* remove attempt info from multiblind activity codes */
      const actCodeNoAttempt = actCode.split('-a')[0];
      const groupString = actCodeNoAttempt.split('-g')[1];

      return Number(groupString);
   }

   /**
    * Get the room of the group corresponding to the given activity ID
    *
    * @param {number} actId
    * @returns {string}
    */
   getGroupRoom(actId) {
      function roomHasActId(roomObj) {
         return roomObj.activities
            .flatMap(x => x.childActivities)
            .some(x => x.id === actId);
      }

      return this.#getRoomObjs()
         .find(roomHasActId)
         .name;
   }

   /**
    * Get the round format, e.g. 'a' for Average of 5 or '3' for Best of 3
    *
    * @param {string} eventId - Event ID, e.g. '333'
    * @param {number} round - Round number
    * @returns {string}
    */
   getFormat(eventId, round) {
      return this.#getRoundObj(eventId, round)
            .format;
   }

   /**
    * Get the cutoff in centiseconds for the given round
    *
    * MULTIBLIND: always returns null, because cutoffs for multiblind should be banned and I don't want to support them
    *
    * FMC: unsupported because this scorecard software does not support FMC
    *
    * @param {string} eventId - Event ID, e.g. '333'
    * @param {number} round - Round number
    * @returns {number | null} Cutoff in centiseconds if one exists, null otherwise
    */
   getCutoffCentisec(eventId, round) {
      if (eventId === '333mbf')
         return null;

      const cutoffObj = this.#getRoundObj(eventId, round).cutoff;

      return cutoffObj === null ? null : cutoffObj.attemptResult;
   }

   /**
    * Get the number of attempts for the cutoff for the given round
    *
    * MULTIBLIND: always returns null, because cutoffs for multiblind should be banned and I don't want to support them
    *
    * FMC: unsupported because this scorecard software does not support FMC
    *
    * @param {string} eventId - Event ID, e.g. '333'
    * @param {number} round - Round number
    * @returns {number | null} Number of attempts for the cutoff if one exists, null otherwise
    */
   getCutoffAttempts(eventId, round) {
      if (eventId === '333mbf')
         return null;

      const cutoffObj = this.#getRoundObj(eventId, round).cutoff;

      return cutoffObj === null ? null : cutoffObj.numberOfAttempts;
   }

   /**
    * Get the time limit in centiseconds for the given round
    *
    * MULTIBLIND: supported; will always return null
    *
    * FMC: unsupported because this scorecard software does not support FMC
    *
    * @param {string} eventId - Event ID, e.g. '333'
    * @param {number} round - Round number
    * @returns {number | null} Time limit in centiseconds; null for multiblind
    */
   getTimeLimit(eventId, round) {
      const roundObj = this.#getRoundObj(eventId, round);

      /* deal with multiblind */
      if (roundObj.timeLimit === null)
         return null;

      return roundObj.timeLimit.centiseconds;
   }

   /**
    * Return true if any competitor is assigned to a group for the round, false otherwise
    *
    * @param {string} eventId - Event ID, e.g. '333'
    * @param {number} round - Round number
    * @returns {bool}
    */
   groupsAreAssigned(eventId, round) {
      // TODO: make this a function since it's used multiple times
      const numAssigned = this
            .getGroupActIds(eventId, round)
            .flatMap(actId => this.getCompetitorsFromActId(actId))
            .length;

      return numAssigned > 0;
   }

   /**
    * Get the number of people advancing to a round, assuming no no-shows
    *
    * For first-round events, just return the number of people assigned to a group
    *
    * @param {string} eventId - Event ID, e.g. '333'
    * @param {number} round - Round number
    * @returns {number} Number of people advancing to the round, assuming no no-shows
    */
   getNumAdvancingToRound(eventId, round) {
      const pctAdvancingStack = [];
      let baseNum;
      let i;

      for (i = round; i >= 1; i--) {
         if (i === 1 || this.groupsAreAssigned(eventId, i)) {
            baseNum = this
               .getGroupActIds(eventId, i)
               .flatMap(actId => this.getCompetitorsFromActId(actId))
               .length;
            break;
         }

         const advanceObj = this
            .#getRoundObj(eventId, i - 1)
            .advancementCondition;

         // TODO: throw error if no advancement conditions exist

         if (advanceObj.type === 'ranking') {
            baseNum = advanceObj.level;
            break;
         }

         // Advancement type is percent
         pctAdvancingStack.push(advanceObj.level);
      }

      let numAdvancing = baseNum;
      let pct;

      while (pctAdvancingStack.length !== 0) {
         pct = pctAdvancingStack.pop();
         numAdvancing = Math.floor(numAdvancing * (pct / 100));
      }

      return numAdvancing;
   }

   /**
    * Return array of round IDs that share cumulative time limits
    *
    * MULTIBLIND: supported; will always return an empty array
    *
    * FMC: unsupported because this scorecard software does not support FMC
    *
    * @param {string} eventId - Event ID, e.g. '333'
    * @param {number} round - Round number
    * @returns {string[]} Array of round IDs, e.g. ['444bf-r1']. If no such rounds exist, the empty array is returned
    */
   getCumulRoundIds(eventId, round) {
      const roundObj = this.#getRoundObj(eventId, round);

      /* deal with multiblind */
      if (roundObj.timeLimit === null)
         return [];

      return roundObj.timeLimit.cumulativeRoundIds;
   }

   /**
    * Return array of person objects of registered and accepted competitors
    *
    * @returns {object[]} Array of person objects
    */
   #getCompetitorObjs() {
      function personIsCompeting(personObj) {
         const registration = personObj.registration;

         return registration !== null &&
                registration.status === 'accepted' &&
                registration.isCompeting;
      }

      return this.#personsArr.filter(personIsCompeting);
   }

   /**
    * Get a list of competitor IDs
    *
    * @returns {number[]}
    */
   getCompetitorRegistrantIds() {
      const competitorObjs = this.#getCompetitorObjs();

      return competitorObjs.map(x => x.registrantId);
   }

   /**
    * Return the person object with a matching registrant ID
    *
    * @param {number} registrantId - Registrant ID of the person
    * @returns {object} Person object
    */
   #getPersonObj(registrantId) {
      return this.#personsArr.find(x => x.registrantId === registrantId);
   }

   /**
    * Return whether or not a person is a new competitor
    *
    * @param {number} registrantId - Registrant ID of the person
    * @returns {bool} - true if the person is a new competitor, false otherwise
    */
   isNewCompetitor(registrantId) {
      const personObj = this.#getPersonObj(registrantId);

      return personObj.wcaId === null;
   }

   /**
    * Get the WCA ID of a person
    *
    * @param {number} registrantId - Registrant ID of the person
    * @returns {string | null} String if the WCA ID exists, null otherwise
    */
   getWcaId(registrantId) {
      const personObj = this.#getPersonObj(registrantId);

      return personObj.wcaId;
   }

   /**
    * Get the name of a person
    *
    * @param {number} registrantId - Registrant ID of the person
    * @returns {string}
    */
   getPersonName(registrantId) {
      const personObj = this.#getPersonObj(registrantId);

      return personObj.name;
   }

   /* Errors */
   static HttpError = class extends Error {};

   /**
    * Fetch WCIF data for the given competition ID, then create a WCIF object
    *
    * @param {string} compId - Competition ID, e.g. 'WesternChampionship2026'
    * @returns {Promise<WCIF>}
    */
   static async fromCompId(compId) {
      const url = `https://www.worldcubeassociation.org/api/v0/competitions/${compId}/wcif/public`;
      const response = await fetch(url);

      if (!response.ok) {
         // TODO: more specific error. also different handling for response.status === 404.
         throw new this.HttpError();
      }

      const data = await response.json();

      return new this(compId, data);
   }
}