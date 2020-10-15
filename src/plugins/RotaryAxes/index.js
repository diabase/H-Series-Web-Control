'use strict'

import Vue from 'vue'
import { registerRoute } from '../../routes'

import RotaryAxes from './RotaryAxes.vue'
import Rotary3DPrintingPanel from './Rotary3DPrintingPanel.vue'
import RotaryAxesControlPanel from './RotaryAxesControlPanel.vue'
import RotaryAxesStatusPanel from './RotaryAxesStatusPanel.vue'

Vue.component('rotary-3d-printing-panel', Rotary3DPrintingPanel);
Vue.component('rotary-axes-control-panel', RotaryAxesControlPanel);
Vue.component('rotary-axes-status-panel', RotaryAxesStatusPanel);

// Register a route via Control -> Rotary Axes
registerRoute(RotaryAxes, {
	Control: {
		RotaryAxes: {
			icon: 'mdi-axis-x-rotate-clockwise',
			caption: 'plugins.rotaryAxes.menuCaption',
			path: '/RotaryAxes',
		},
	}
});