// panel.js — receives messages from parent (content_script iframe host)
(function(){
  function sanitizeText(s){
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function setRisk(risk, confidence){
    const riskNode = document.getElementById('cs-risk');
    const confNode = document.getElementById('cs-confidence');
    riskNode.textContent = risk;
    confNode.textContent = `${Math.round(confidence*100)}% confidence`;
    riskNode.style.background = risk === 'High' ? '#3b0b0b' : (risk==='Medium'? 'rgba(73,46,5,0.15)' : 'rgba(2,39,20,0.1)');
  }

  function populateExplanations(expls){
    const node = document.getElementById('cs-explain');
    node.innerHTML = '<h4>Why we flagged this</h4>';
    const ul = document.createElement('ul');
    (expls||[]).forEach(e=>{
      const li = document.createElement('li');
      li.innerHTML = sanitizeText(e);
      ul.appendChild(li);
    });
    node.appendChild(ul);
  }

  function populateLinks(links){
    const list = document.getElementById('cs-links-list');
    list.innerHTML = '';
    (links||[]).forEach(url=>{
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = url;
      a.textContent = url;
      a.target = '_blank';
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function populateTeachback(explanations, bodyText){
    const choicesNode = document.getElementById('cs-choices');
    choicesNode.innerHTML = '';
    // choose up to 3 phrases from explanations or from body text heuristics
    const phrases = explanations.slice(0,2);
    // fallback: extract top urgency phrases from body (simple)
    if(phrases.length < 3){
      const maybe = [];
      const matches = (bodyText||'').match(/\b(verify your account|act now|suspended|click the link|login)\b/gi);
      if(matches) matches.forEach(m=>maybe.push(m));
      maybe.slice(0,3-phrases.length).forEach(m=>phrases.push(m));
    }
    // Add some decoy choices
    const decoys = ['Kind regards', 'Meeting reminder', 'Course update'];
    while(phrases.length < 4) phrases.push(decoys.shift());

    // Shuffle
    phrases.sort(()=>Math.random()-0.5);

    phrases.forEach(p=>{
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.textContent = p;
      btn.addEventListener('click', () => {
        // simple correctness: if phrase in explanations then it's correct
        const correct = explanations.some(e => e.toLowerCase().includes(p.toLowerCase()));
        btn.classList.add(correct ? 'correct' : 'wrong');
        // mark others disabled
        Array.from(choicesNode.children).forEach(ch => ch.disabled = true);
      });
      choicesNode.appendChild(btn);
    });
  }

  // close / dismiss handlers
  document.getElementById('cs-close').addEventListener('click', ()=> window.parent.postMessage({ type:'cs-close' }, '*'));
  document.getElementById('cs-dismiss').addEventListener('click', ()=> window.parent.postMessage({ type:'cs-close' }, '*'));
  document.getElementById('cs-learn').addEventListener('click', ()=>{
    // quick help
    alert('Avoid clicking unknown links. Verify sender domain. Check for urgency language.');
  });

  // Listen to messages posted by parent window (content script)
  window.addEventListener('message',(ev)=>{
    try{
      const data = ev.data || {};
      if(data && data.type === 'cs-result'){
        const result = data.payload || {};
        setRisk(result.risk_level || 'Unknown', result.confidence_score || 0);
        populateExplanations(result.explanations || []);
        populateLinks(result.suspicious_links || []);
        populateTeachback(result.explanations || [], result.body || '');
      }
    }catch(e){
      console.error('Panel message error', e);
    }
  }, false);

})();