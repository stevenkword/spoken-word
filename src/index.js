
import Speech from './speech';
export { setLocaleData } from './i18n';

/**
 * Key for localStorage state persistence.
 *
 * @type {string}
 */
const STATE_STORAGE_KEY = 'spokenWordState';

/**
 * Mapping speech root elements to their corresponding Speech instances.
 *
 * @type {Map<Element, Speech>}
 */
const speechRootMap = new Map();

/**
 * Get iterator for all Speech instances.
 *
 * @returns {Iterator.<Speech>} Instances.
 */
export function getInstances() {
	return speechRootMap.values();
}

/**
 * Default utterance options.
 *
 * @type {{pitch: number, rate: number, languageVoices: Object<string, string>}}
 */
const DEFAULT_UTTERANCE_OPTIONS = {
	pitch: 1.0,
	rate: 1.0,
	languageVoices: {},
};

/**
 * Default utterance options.
 *
 * This is set when calling initialize() with a defaultUtteranceOptions param. Any options storage in localStorage
 * get merged on top of this.
 *
 * @type {Object}
 */
let customDefaultUtteranceOptions = {};

/**
 * CSS selector for finding the content element.
 *
 * @type {string}
 */
const CONTENT_SELECTOR = '.hentry .entry-content, .h-entry .e-content, [itemprop="articleBody"]';

/**
 * Find article roots.
 *
 * @param {Element} root     - Root element.
 * @param {string}  selector - Selector.
 * @returns {Array} Article roots.
 */
function findContentRoots( root, selector ) {
	if ( root.matches( selector ) ) {
		return [ root ];
	}

	// @todo What about nested content?
	return [ ...root.querySelectorAll( selector ) ];
}

/**
 * Create Speech instances.
 *
 * @param {Element} element         - Element to look for content.
 * @param {string}  contentSelector - Selector for content elements.
 * @param {object}  chunkifyOptions - Options passed to chunkify().
 * @param {bool}    useDashicons    - Whether to use Dashicons in playback controls.
 */
function createSpeeches( { element, contentSelector, chunkifyOptions, useDashicons } ) {
	const rootElements = findContentRoots( element, contentSelector );
	for ( const rootElement of rootElements ) {
		// Skip elements already added.
		if ( speechRootMap.has( rootElement ) ) {
			continue;
		}

		const speech = new Speech( {
			rootElement,
			chunkifyOptions,
			useDashicons,
			utteranceOptions: getUtteranceOptions(),
		} );

		speechRootMap.set( rootElement, speech );

		// Stop playing all other speeches when playing one.
		speech.on( 'change:playing', ( playing ) => {
			if ( ! playing ) {
				return;
			}
			for ( const otherSpeech of speechRootMap.values() ) {
				if ( otherSpeech !== speech ) {
					otherSpeech.stop();
				}
			}
		} );

		speech.on( 'sharedStateChange', ( sharedState ) => {
			localStorage.setItem( STATE_STORAGE_KEY, JSON.stringify( sharedState ) );

			for ( const otherSpeech of speechRootMap.values() ) {
				if ( otherSpeech !== speech ) {
					otherSpeech.setState( sharedState );
				}
			}
		} );

		speech.initialize();
	}
}

// Update speech instances in response to saved state changing in another tab.
window.addEventListener( 'storage', ( event ) => {
	if ( STATE_STORAGE_KEY !== event.key || event.storageArea !== localStorage ) {
		return;
	}
	for ( const speech of speechRootMap.values() ) {
		speech.setState( getUtteranceOptions() );
	}
} );

/**
 * Get utterance options merging defaults with custom defaults and localStorage overrides.
 *
 * @return {{pitch: number, rate: number, languageVoices: Object<string, string>}} Utterance options.
 */
function getUtteranceOptions() {
	const utteranceOptions = Object.assign(
		{},
		DEFAULT_UTTERANCE_OPTIONS,
		customDefaultUtteranceOptions
	);
	if ( ! localStorage.getItem( STATE_STORAGE_KEY ) ) {
		return utteranceOptions;
	}
	try {
		const sharedState = JSON.parse( localStorage.getItem( STATE_STORAGE_KEY ) );
		for ( const key of Object.keys( DEFAULT_UTTERANCE_OPTIONS ) ) {
			if ( 'undefined' !== typeof sharedState[ key ] ) {
				utteranceOptions[ key ] = sharedState[ key ];
			}
		}
	} catch ( e ) {
		localStorage.removeItem( STATE_STORAGE_KEY );
	}
	return utteranceOptions;
}

/**
 * Destroy Speech instances in element.
 *
 * @param {Element} element         - Element to look for content.
 * @param {string}  contentSelector - Selector for content elements.
 */
function destroySpeeches( { element, contentSelector } ) {
	const speechRoots = findContentRoots( element, contentSelector );
	for ( const rootElement of speechRoots ) {
		const speech = speechRootMap.get( rootElement );
		if ( speech ) {
			speech.destroy();
			speechRootMap.delete( rootElement );
		}
	}
}

/**
 * Determine if system has support.
 *
 * @todo This needs to be revisited in the future.
 * @return {boolean} Whether the system has support. Returns if not Android or iOS.
 */
const HAS_SYSTEM_SUPPORT = () => {
	return ! /\b(Android|iPhone|iPad|iPod)\b/i.test( navigator.userAgent );
};

/**
 * Initialize.
 *
 * @param {string}   contentSelector         - CSS Selector to find the elements for speaking.
 * @param {Element}  rootElement             - Root element within which to look for content
 * @param {Object}   chunkifyOptions         - Options passed into chunkify.
 * @param {boolean}  useDashicons            - Whether to use Dashicons.
 * @param {Object}   defaultUtteranceOptions - Default utterance options when none are supplied from localStorage.
 * @param {Function} hasSystemSupport        - Function which determines whether the user's operating supports the functionality. Defaults to return false on iOS or Android.
 * @returns {Promise} Promise.
 */
export function initialize( {
	rootElement,
	contentSelector = CONTENT_SELECTOR,
	useDashicons,
	chunkifyOptions,
	defaultUtteranceOptions = DEFAULT_UTTERANCE_OPTIONS,
	hasSystemSupport = HAS_SYSTEM_SUPPORT,
} = {} ) {
	customDefaultUtteranceOptions = defaultUtteranceOptions;

	return new Promise( ( resolve, reject ) => {
		if ( typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined' ) {
			reject( 'speech_synthesis_not_supported' );
			return;
		}
		if ( ! hasSystemSupport() ) {
			reject( 'system_not_supported' );
			return;
		}

		const mutationObserver = new MutationObserver( ( mutations ) => {
			for ( const mutation of mutations ) {
				for ( const addedNode of [ ...mutation.addedNodes ].filter( ( node ) => node.nodeType === Node.ELEMENT_NODE ) ) {
					createSpeeches( {
						element: addedNode,
						contentSelector,
						useDashicons,
						chunkifyOptions,
					} );
				}
				for ( const removedNode of [ ...mutation.removedNodes ].filter( ( node ) => node.nodeType === Node.ELEMENT_NODE ) ) {
					destroySpeeches( {
						element: removedNode,
						contentSelector,
					} );
				}
			}
		} );

		const uponReady = () => {
			const element = rootElement || document.body;

			// Probably a bug in Chrome that utterance is not canceled upon unload.
			window.addEventListener( 'unload', () => {
				speechSynthesis.cancel();
			} );

			createSpeeches( {
				element,
				contentSelector,
				chunkifyOptions,
				useDashicons,
			} );

			mutationObserver.observe( element, {
				childList: true,
				subtree: true,
			} );

			resolve();
		};

		if ( 'complete' === document.readyState ) {
			uponReady();
		} else {
			document.addEventListener( 'DOMContentLoaded', uponReady );
		}
	} );
}
