let ytPlayers = {};
let currentStreams = []; // Array of objects { id, url, videoId }
let globalVolume = 50;
let isMuted = false;
let isSwipeMode = false;

// Load presets from LocalStorage
let presets = JSON.parse(localStorage.getItem('yt-presets')) || [];

const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubeIframeAPIReady() {
    console.log("YouTube IFrame API Ready.");
}

document.addEventListener('DOMContentLoaded', () => {
    // Desktop elements
    const streamInput = document.getElementById('stream-url-input');
    const addBtn = document.getElementById('add-stream-btn');
    const layoutToggleBtn = document.getElementById('layout-toggle-btn');
    const presetsBtn = document.getElementById('presets-btn');
    
    // Mobile elements
    const mobileSearchContainer = document.getElementById('mobile-search-container');
    const mobileStreamInput = document.getElementById('mobile-stream-url-input');
    const mobileAddBtn = document.getElementById('mobile-add-stream-btn');
    const navAdd = document.getElementById('mobile-nav-add');
    const navPresets = document.getElementById('mobile-nav-presets');
    const navLayout = document.getElementById('mobile-nav-layout');
    const navMute = document.getElementById('mobile-nav-mute');
    
    const grid = document.getElementById('streams-grid');
    const template = document.getElementById('stream-card-template');
    
    // Modal
    const modal = document.getElementById('presets-modal');
    const closeModal = document.querySelector('.close-modal');
    const savePresetBtn = document.getElementById('save-preset-btn');
    const presetNameInput = document.getElementById('preset-name-input');
    const presetsList = document.getElementById('presets-list');

    // SortableJS setup
    let sortable = Sortable.create(grid, {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        filter: '.empty-message',
        onEnd: () => {
            // Reorder logic if needed
        }
    });

    function extractVideoId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match ? match[1] : (url.length === 11 ? url : null);
    }

    function addStream(url) {
        if(!url) return;
        const videoId = extractVideoId(url);
        if (!videoId) {
            alert('有効なYouTube URLを入力してください。');
            return;
        }

        const uniqueId = 'stream_' + Math.random().toString(36).substr(2, 9);
        currentStreams.push({ id: uniqueId, url, videoId });

        if (currentStreams.length === 1) {
            grid.classList.remove('empty-state');
            grid.innerHTML = '';
        }

        const domain = window.location.hostname || 'localhost';
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.stream-card');
        card.dataset.streamId = uniqueId;
        
        const playerPlaceholder = card.querySelector('.youtube-player-placeholder');
        playerPlaceholder.id = 'player-' + uniqueId;

        const chatContainer = card.querySelector('.chat-container');
        const chatIframe = document.createElement('iframe');
        chatIframe.src = `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${domain}&dark_theme=1`;
        chatContainer.appendChild(chatIframe);

        const closeBtn = card.querySelector('.remove-stream-btn');
        closeBtn.addEventListener('click', () => {
            if(ytPlayers[uniqueId]) {
                ytPlayers[uniqueId].destroy();
                delete ytPlayers[uniqueId];
            }
            card.remove();
            currentStreams = currentStreams.filter(s => s.id !== uniqueId);
            updateGrid();
        });

        const chatToggleBtn = card.querySelector('.toggle-chat-btn');
        const streamBody = card.querySelector('.stream-body');
        chatToggleBtn.addEventListener('click', () => {
            streamBody.classList.toggle('has-chat');
            chatToggleBtn.classList.toggle('active');
        });
        chatToggleBtn.classList.add('active');

        card.querySelector('.stream-title').textContent = `動画 (${videoId})`;
        grid.appendChild(card);
        
        updateGrid();

        const initPlayer = () => {
            if (typeof YT === 'undefined' || !YT.Player) {
                setTimeout(initPlayer, 100);
                return;
            }
            ytPlayers[uniqueId] = new YT.Player('player-' + uniqueId, {
                videoId: videoId,
                playerVars: { 'autoplay': 1, 'controls': 1, 'mute': 0 },
                events: {
                    'onReady': (event) => {
                        event.target.setVolume(isMuted ? 0 : globalVolume);
                    }
                }
            });
        };
        initPlayer();
        
        // Reset inputs
        streamInput.value = '';
        mobileStreamInput.value = '';
        mobileSearchContainer.classList.add('hidden'); // hide mobile input after adding
    }

    function updateGrid() {
        const count = currentStreams.length;
        if (count === 0) {
            grid.classList.add('empty-state');
            grid.innerHTML = `
                <div class="empty-message">
                    <span class="material-icons empty-icon text-stone">video_library</span>
                    <h2>配信がありません</h2>
                    <p>上の検索バーから配信URLを追加するか、<br>プリセットから読み込んでください。</p>
                </div>
            `;
            grid.style.gridTemplateColumns = '1fr';
            grid.style.gridTemplateRows = '1fr';
        } else if (isSwipeMode) {
            // handled by CSS flex/snap
            grid.style.gridTemplateColumns = '';
            grid.style.gridTemplateRows = '';
        } else {
            // Normal Grid Mode
            if (count === 1) {
                grid.style.gridTemplateColumns = '1fr';
                grid.style.gridTemplateRows = '1fr';
            }
            else if (count === 2) {
                grid.style.gridTemplateColumns = '1fr 1fr';
                grid.style.gridTemplateRows = '1fr';
            }
            else if (count <= 4) {
                grid.style.gridTemplateColumns = '1fr 1fr';
                grid.style.gridTemplateRows = '1fr 1fr';
            }
            else {
                grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
                grid.style.gridTemplateRows = 'auto';
            }
        }
    }

    function toggleLayout() {
        isSwipeMode = !isSwipeMode;
        if (isSwipeMode) {
            grid.classList.add('swipe-mode');
            sortable.option("disabled", true); // Disable drag in swipe mode
            document.getElementById('layout-toggle-btn').innerHTML = '<span class="material-icons">grid_view</span>';
            document.getElementById('mobile-layout-icon').textContent = 'grid_view';
        } else {
            grid.classList.remove('swipe-mode');
            sortable.option("disabled", false);
            document.getElementById('layout-toggle-btn').innerHTML = '<span class="material-icons">view_carousel</span>';
            document.getElementById('mobile-layout-icon').textContent = 'view_carousel';
        }
        updateGrid();
    }

    // Input handlers
    [addBtn, mobileAddBtn].forEach(btn => btn.addEventListener('click', () => {
        const url = btn.id === 'add-stream-btn' ? streamInput.value : mobileStreamInput.value;
        addStream(url);
    }));

    [streamInput, mobileStreamInput].forEach(inp => inp.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addStream(e.target.value);
    }));

    // Desktop Buttons
    layoutToggleBtn.addEventListener('click', toggleLayout);
    presetsBtn.addEventListener('click', openModal);

    // Global volume
    document.getElementById('global-volume').addEventListener('input', (e) => {
        globalVolume = parseInt(e.target.value);
        Object.values(ytPlayers).forEach(p => {
            if(p.setVolume) { p.setVolume(globalVolume); p.unMute(); }
        });
        isMuted = false;
        document.getElementById('global-mute-btn').textContent = 'volume_up';
        document.getElementById('mobile-mute-icon').textContent = 'volume_up';
    });

    document.getElementById('global-mute-btn').addEventListener('click', toggleMute);

    // Mobile Navigation
    navAdd.addEventListener('click', () => {
        mobileSearchContainer.classList.toggle('hidden');
        if(!mobileSearchContainer.classList.hidden) mobileStreamInput.focus();
    });
    navLayout.addEventListener('click', toggleLayout);
    navPresets.addEventListener('click', openModal);
    navMute.addEventListener('click', toggleMute);

    function toggleMute() {
        isMuted = !isMuted;
        const icon = isMuted ? 'volume_off' : 'volume_up';
        document.getElementById('global-mute-btn').textContent = icon;
        document.getElementById('mobile-mute-icon').textContent = icon;
        Object.values(ytPlayers).forEach(p => {
            if (isMuted) { p.mute && p.mute(); } 
            else { p.unMute && p.unMute(); p.setVolume && p.setVolume(globalVolume); }
        });
    }

    // Preset Modal Logic
    function openModal() {
        modal.classList.remove('hidden');
        renderPresets();
    }
    closeModal.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => { if(e.target === modal) modal.classList.add('hidden'); });

    savePresetBtn.addEventListener('click', () => {
        const name = presetNameInput.value.trim();
        if (!name) return alert('プリセット名を入力してください');
        if (currentStreams.length === 0) return alert('保存する配信がありません');
        
        const urls = currentStreams.map(s => s.url);
        presets.push({ id: Date.now(), name, urls });
        localStorage.setItem('yt-presets', JSON.stringify(presets));
        presetNameInput.value = '';
        renderPresets();
    });

    function renderPresets() {
        presetsList.innerHTML = '';
        if (presets.length === 0) {
            presetsList.innerHTML = '<p class="text-stone">保存されたプリセットはありません</p>';
            return;
        }
        presets.forEach(preset => {
            const el = document.createElement('div');
            el.className = 'preset-item';
            el.innerHTML = `
                <div class="preset-item-info">
                    <strong>${preset.name}</strong>
                    <span>${preset.urls.length} 配信</span>
                </div>
                <div class="preset-actions">
                    <button class="load-preset" data-id="${preset.id}"><span class="material-icons">play_arrow</span></button>
                    <button class="del-preset" data-id="${preset.id}"><span class="material-icons">delete</span></button>
                </div>
            `;
            presetsList.appendChild(el);
        });

        document.querySelectorAll('.load-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                const preset = presets.find(p => p.id === id);
                if(preset) {
                    // Close current streams
                    document.querySelectorAll('.remove-stream-btn').forEach(b => b.click());
                    // Load new ones
                    preset.urls.forEach(url => addStream(url));
                    modal.classList.add('hidden');
                }
            });
        });

        document.querySelectorAll('.del-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                presets = presets.filter(p => p.id !== id);
                localStorage.setItem('yt-presets', JSON.stringify(presets));
                renderPresets();
            });
        });
    }
});
