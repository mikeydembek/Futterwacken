<template>
<nav class="tab-bar">
  <button 
    v-for="tab in tabs"
    :key="tab.id"
    @click="$emit('change-tab', tab.id)"
    :class="['tab', { 'tab-active': activeTab === tab.id }]"
    :aria-label="tab.label"
  >
    <!-- Add Icon - Inline SVG using currentColor -->
    <svg
      v-if="tab.id === 'add'"
      class="tab-icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 8V16"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 12H16"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
      
    <!-- Today Icon - updated SVG, colorized via currentColor -->
    <svg
      v-else-if="tab.id === 'today'"
      class="tab-icon"
      width="24"
      height="24"
      viewBox="0 0 5.148757 5.8647017"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(24.171357,-58.151196)">
        <path
          d="m -21.764754,63.890696 c -0.08161,-0.01176 -0.19161,-0.04676 -0.281198,-0.08948 -0.268432,-0.127999 -0.461602,-0.367041 -0.53671,-0.664163 l -0.01829,-0.07233 -0.588466,-0.0044 c -0.623846,-0.0047 -0.639523,-0.0057 -0.716077,-0.04472 -0.04817,-0.02458 -0.09931,-0.07906 -0.126804,-0.135144 -0.02282,-0.04655 -0.02383,-0.05323 -0.02339,-0.159067 3.54e-4,-0.09861 0.0025,-0.117948 0.02345,-0.180036 0.05032,-0.151749 0.0941,-0.219187 0.324327,-0.499477 0.161585,-0.196719 0.213348,-0.27399 0.253956,-0.379079 0.07225,-0.18697 0.08685,-0.304504 0.09738,-0.784085 0.0092,-0.419656 0.01606,-0.51916 0.04601,-0.669635 0.0656,-0.329552 0.220073,-0.612426 0.462642,-0.847213 0.174459,-0.168862 0.354978,-0.278671 0.593043,-0.360748 l 0.06636,-0.02288 0.0047,-0.106769 c 0.0095,-0.215483 0.07755,-0.360004 0.225537,-0.478776 0.10874,-0.08727 0.224971,-0.126471 0.373568,-0.125995 0.115781,3.86e-4 0.187251,0.01971 0.284604,0.07702 0.08034,0.04729 0.181651,0.150694 0.220036,0.224581 0.05043,0.09708 0.06536,0.157632 0.07119,0.288847 l 0.0052,0.116995 0.07365,0.02438 c 0.09624,0.03186 0.287618,0.126259 0.360071,0.177606 0.126839,0.08989 0.295385,0.250127 0.397892,0.378272 0.132511,0.165656 0.247115,0.417205 0.29267,0.6424 0.03325,0.164346 0.03918,0.256077 0.05028,0.777426 0.0061,0.284411 0.01012,0.359232 0.02359,0.433721 0.0239,0.132274 0.05311,0.226973 0.09863,0.31978 0.04684,0.0955 0.0745,0.134441 0.237828,0.334894 0.2141,0.262763 0.25876,0.332326 0.307347,0.47873 0.02079,0.06265 0.02312,0.08094 0.02348,0.184128 3.87e-4,0.108823 -6.95e-4,0.116619 -0.02144,0.155485 -0.04201,0.07874 -0.131518,0.146763 -0.219928,0.167137 -0.02151,0.0049 -0.166055,0.0085 -0.352251,0.0086 -0.173675,1.27e-4 -0.437659,0.0027 -0.586632,0.0056 l -0.27086,0.0054 -0.01377,0.06211 c -0.08631,0.389305 -0.406185,0.685838 -0.816933,0.757326 -0.0787,0.0137 -0.261304,0.0156 -0.344678,0.0036 z m 0.351995,-0.280337 c 0.221497,-0.06069 0.385858,-0.186251 0.488833,-0.373449 0.02286,-0.04156 0.06344,-0.149416 0.06344,-0.168622 -0.49066,-0.005 -0.981434,-0.0032 -1.472135,-0.0032 l 0.01207,0.04296 c 0.03407,0.121222 0.141006,0.281793 0.242144,0.363565 0.182754,0.147761 0.43835,0.201048 0.665644,0.138774 z m 2.000513,-0.835571 c 0.01736,-0.01848 0.01861,-0.02537 0.01445,-0.08032 -0.0052,-0.06938 -0.0372,-0.158972 -0.08089,-0.226801 -0.01594,-0.02475 -0.09436,-0.124183 -0.174268,-0.220952 -0.248156,-0.300537 -0.322015,-0.423209 -0.380362,-0.631739 -0.04581,-0.163737 -0.05579,-0.276079 -0.06601,-0.743077 -0.0088,-0.402864 -0.01621,-0.515344 -0.04172,-0.634216 -0.09901,-0.461518 -0.443103,-0.841273 -0.892279,-0.984762 -0.183337,-0.05856 -0.366559,-0.07991 -0.620383,-0.07228 -0.09258,0.0028 -0.197793,0.009 -0.2338,0.01384 -0.327655,0.04392 -0.576686,0.163241 -0.793793,0.380348 -0.110665,0.110665 -0.18408,0.212828 -0.252863,0.351887 -0.08193,0.165649 -0.122198,0.305068 -0.144165,0.499189 -0.0051,0.04501 -0.01254,0.258596 -0.01658,0.47464 -0.0089,0.47842 -0.01968,0.576356 -0.08562,0.777425 -0.06143,0.18737 -0.145567,0.321592 -0.35783,0.570875 -0.131597,0.154548 -0.166201,0.202166 -0.203618,0.280201 -0.06363,0.132689 -0.07185,0.218997 -0.02434,0.255472 0.01011,0.0078 0.488172,0.01003 2.174027,0.01023 l 2.161044,2.42e-4 z m -1.869867,-3.916011 c -0.01413,-0.146255 -0.06796,-0.235885 -0.173939,-0.289588 -0.142926,-0.07243 -0.320256,-0.02342 -0.400419,0.110657 -0.03155,0.05277 -0.0515,0.125108 -0.05149,0.186787 l 1e-6,0.04534 h 0.315494 0.315492 z"
          fill="currentColor"
          stroke="currentColor"
          stroke-width="0.231"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
    </svg>
    
    <!-- Calendar Icon - your SVG, colorized via currentColor -->
    <svg
      v-else-if="tab.id === 'calendar'"
      class="tab-icon"
      width="24"
      height="24"
      viewBox="0 0 4.7863903 5.6022382"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(16.8509,-58.103185)">
        <g>
          <rect
            x="-16.586317"
            y="58.896935"
            width="4.2572236"
            height="4.5439029"
            rx="0.52916664"
            stroke="currentColor"
            stroke-width="0.529167"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />
          <path d="m -13.411317,58.367768 v 1.058333"
            stroke="currentColor" stroke-width="0.529167" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="m -15.527983,58.367768 v 1.058333"
            stroke="currentColor" stroke-width="0.529167" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="m -16.586317,60.484435 h 4.233334"
            stroke="currentColor" stroke-width="0.529167" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="m -15.527983,61.323162 h 0.0026"
            stroke="currentColor" stroke-width="0.529167" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="m -14.46965,61.323162 h 0.0026"
            stroke="currentColor" stroke-width="0.529167" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="m -13.411317,61.323162 h 0.0026"
            stroke="currentColor" stroke-width="0.529167" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="m -15.527983,62.381495 h 0.0026"
            stroke="currentColor" stroke-width="0.529167" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="m -14.46965,62.381495 h 0.0026"
            stroke="currentColor" stroke-width="0.529167" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="m -13.411317,62.381495 h 0.0026"
            stroke="currentColor" stroke-width="0.529167" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </g>
      </g>
    </svg>
  </button>
</nav>
</template>

<script>
export default {
name: 'TabBar',
props: {
  activeTab: {
    type: String,
    required: true
  }
},
emits: ['change-tab'],
data() {
  return {
    tabs: [
      { id: 'add', label: 'Add Video' },
      { id: 'today', label: 'Today' },
      { id: 'calendar', label: 'Calendar' }
    ]
  };
}
};
</script>

<style scoped>
.tab-bar {
position: fixed;
bottom: 0;
left: 0;
right: 0;

display: flex;
justify-content: space-around;
align-items: center;

background-color: var(--bg-secondary);
border-top: 1px solid var(--bg-tertiary);
height: 60px;

padding-bottom: env(safe-area-inset-bottom);
z-index: 100;
}

.tab {
flex: 1;
height: 100%;

display: flex;
align-items: center;
justify-content: center;

background: none;
border: none;
outline: none;
cursor: pointer;

color: var(--text-secondary);
transition: all 0.2s ease;

user-select: none;
-webkit-tap-highlight-color: transparent;
}

/* Active tab styling */
.tab { color: var(--text-secondary); }
.tab-active { color: var(--accent-primary); }
.tab-icon { width: 24px; height: 24px; display: block; }
.tab-active .tab-icon { filter: drop-shadow(0 0 8px var(--accent-primary)); }

/* Icon styling - works for both SVG and emoji */
.tab-icon {
font-size: 24px;
line-height: 1;
transition: all 0.2s ease;

/* For SVG icons */
width: 24px;
height: 24px;
}

/* Blue glow effect for active tab */
.tab-active .tab-icon {
filter: drop-shadow(0 0 8px var(--accent-primary));
}
</style>