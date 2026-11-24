/* Browser-only learner mode. Installed after classroom extensions, before first render. */
if (PUBLIC_PRACTICE) {
  var localStore = window.RomanWayLocalProgress.create(function(){return window.localStorage},fresh);
  var localProgress = localStore.read();
  var localNotice = 'Progress stays in this browser on this device. Clearing site data or using private browsing can erase it. Anyone using this browser profile can see this progress.';
  var localSaved = false;
  LS = window.RomanWayLocalProgress.key;
  AUTH.phase = 'ready';
  CLOUD.phase = 'local';
  CLOUD.ready = true;
  CLOUD.message = localStore.issue || 'Progress saved on this device';
  CLOUD.teacher = false;
  S = localProgress;
  window.__S = S;
  V.screen = 'login';
  document.title = 'Latin: The Roman Way — Public Practice';

  function localStatus() {
    CLOUD.message = localStore.issue || (localSaved ? 'Saved on this device' : 'Progress stays on this device');
    var node = document.getElementById('cloud-status');
    if (node) node.textContent = CLOUD.message;
    var warning = document.getElementById('save-warning');
    if (!localStore.issue) {if (warning) warning.remove();return;}
    if (!warning) {
      warning = document.createElement('div');warning.id='save-warning';warning.className='alert';
      warning.setAttribute('role','alert');warning.style.cssText='margin:12px 16px;overflow-wrap:anywhere';
      document.body.insertBefore(warning,$app);
    }
    warning.textContent = localStore.issue;
    var retry = document.createElement('button');retry.type='button';retry.className='btn ghost sm';retry.textContent='Retry saving';
    retry.addEventListener('click',function(){if(S.user)persist()});warning.appendChild(retry);
  }
  var saveLocalProgress = function() {
    if (!S.user) return false;
    S.settings.aiFeedback = false;
    localSaved = localStore.save(S);
    localStatus();
    return localSaved;
  };
  function beginLocalPractice() {
    /* This is an internal learner role, not an authenticated account. */
    S.user = {role:'student',name:'Learner',start:'student'};
    V.screen='home';V.practice=null;V.game=null;
    persist();render(true);
  }
  screenLogin = function(){
    return '<main class="wrap narrow"><h1 class="display">Latin: The Roman Way</h1><p class="lede">Public Practice</p><section class="panel"><h2>Welcome</h2><p>Study Latin and explore the Roman world. No account or sign-in is needed.</p><button class="btn" data-act="local-start">Start or resume practice</button></section><p class="note">'+esc(localNotice)+'</p></main>';
  };
  screenSignin = function(){
    return '<main class="wrap narrow"><div class="crumb"><button class="link" data-act="home">All lessons</button></div><h1>Progress on this device</h1><section class="panel"><p>'+esc(localNotice)+'</p><p role="status">'+esc(CLOUD.message)+'</p><button class="btn ghost" data-act="local-save">Save now</button></section></main>';
  };
  var classroomHeader = header;
  header = function(){return classroomHeader().replace('>Account</button>','>Device progress</button>').replace(/<button[^>]*data-act="signout"[^>]*>Sign out<\/button>/,'').replace('Volumes I and II</span>','Public Practice</span>').replace('Volume I</span>','Public Practice</span>')};
  ACT['local-start']=beginLocalPractice;
  ACT['local-save']=function(){persist();render()};
  ACT['login-student']=ACT['auth-google']=beginLocalPractice;
  ACT['login-instructor']=ACT['toggle-view']=function(){V.screen='signin';render(true)};
  ACT.signout=function(){persist();V.screen='login';render(true)};
  ACT['cloud-local-signout']=ACT.signout;
  ACT['cloud-retry']=ACT['local-save'];
  /* Never start classroom identity, listeners, or a legacy work import in this mode. */
  window.RomanWayAuthApp.setUser=function(){};
  window.RomanWayAuthApp.databaseReady=function(){};
  ACT['auth-import-confirm']=function(){};
  window.addEventListener('pagehide',function(){if(S.user)persist()});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'&&S.user)persist()});
  if (localStore.issue) localStatus();
}
