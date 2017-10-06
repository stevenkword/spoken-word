<?php
/**
 * Plugin Name: Spoken Content (Text to Speech)
 */

add_filter( 'the_content', function( $content ) {
	if ( is_feed() ) { // @todo Better condition.
		return $content;
	}
	ob_start();
	?>
	<fieldset hidden class="text-to-speech-controls">
		<legend><?php esc_html_e( 'Speak Article' ); ?></legend>
		<!-- TODO: Dashicons or Unicode. -->
		<div>
			<button type="button" class="play">
				Play
			</button>
			<button type="button" class="previous" disabled>
				Previous
			</button>
			<button type="button" class="pause-resume pause" disabled>
				Pause/Resume
			</button>
			<button type="button" class="next" disabled>
				Next
			</button>
			<button type="button" class="stop" disabled>
				Stop
			</button>
		</div>
		<details class="text-to-speech-controls-advanced">
			<summary>Advanced</summary>
			<div>
				<label>
					Voice:
					<select class="voice"></select>
				</label>
			</div>
			<div>
				<label>
					Rate:
					<input type="range" class="rate" min="0.1" step="0.1" max="10" value="1">
				</label>
			</div>
			<div>
				<label>
					Pitch:
					<input type="range" class="pitch" value="1" min="0" max="2" step="0.1">
				</label>
			</div>
		</details>
		<!-- Volume -->
		<!-- Rate -->
		<!-- Pitch -->
	</fieldset>
	<?php
	$controls = ob_get_clean();
	return $controls . $content;
}, 100 );

add_action( 'wp_enqueue_scripts', function() {
	wp_enqueue_script( 'text-to-speech', plugin_dir_url( __FILE__ ) . 'text-to-speech.js', array( 'jquery' ) );
	wp_enqueue_style( 'text-to-speech', plugin_dir_url( __FILE__ ) . 'text-to-speech.css' );
} );
