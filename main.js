
import { WCIF } from './wcif.js';
import { genScPdfsFromWcif } from './sc_pdf.js';

const scForm = document.querySelector('#scorecardForm');
scForm.addEventListener('submit', makePdf);

let wcif;

async function makePdf(event) {
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

    genScPdfsFromWcif(wcif);
}