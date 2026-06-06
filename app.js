let ytPlayers = {}; // 格納用オブジェクト { 固有ID: YT.Player }
let globalVolume = 50;

// ==========================================
// YouTube IFrame APIの読み込み
// ==========================================
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// APIの準備完了コールバック
function onYouTubeIframeAPIReady() {
    console.log("YouTube IFrame API Ready.");
}

document.addEventListener('DOMContentLoaded', () => {
    const streamInput = document.getElementById('stream-url-input');
    const addBtn = document.getElementById('add-stream-btn');
    const grid = document.getElementById('streams-grid');
    const template = document.getElementById('stream-card-template');
    const layoutToggleBtn = document.getElementById('layout-toggle-btn');
    const globalVolumeSlider = document.getElementById('global-volume');
    const globalMuteBtn = document.getElementById('global-mute-btn');
    
    let streamIds = []; // 画面上のIDリスト

    // ==========================================
    // SortableJSの初期化 (ドラッグ＆ドロップ対応)
    // ==========================================
    Sortable.create(grid, {
        handle: '.drag-handle', // ドラッグ可能な部分
        animation: 150,         // アニメーション速度
        ghostClass: 'sortable-ghost', // ドロップ先のスタイル
        filter: '.empty-message'
    });

    // ==========================================
    // ユーティリティ
    // ==========================================
    function extractVideoId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match ? match[1] : (url.length === 11 ? url : null);
    }

    function getEmbedDomain() {
        const hostname = window.location.hostname;
        return hostname ? hostname : 'localhost';
    }

    // ==========================================
    // ストリームの追加処理
    // ==========================================
    function addStream(videoId) {
        if (!videoId) return;

        // 一意のIDを生成 (同じ動画を複数開く可能性も考慮)
        const uniqueId = 'stream_' + Math.random().toString(36).substr(2, 9);

        // 空状態メッセージを消す
        if (streamIds.length === 0) {
            grid.classList.remove('empty-state');
            grid.innerHTML = '';
        }

        const domain = getEmbedDomain();
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.stream-card');
        card.dataset.streamId = uniqueId;
        
        // 動画プレースホルダーの設定
        const playerPlaceholder = card.querySelector('.youtube-player-placeholder');
        playerPlaceholder.id = 'player-' + uniqueId; // APIが認識するためのID

        // チャットiframeの設定
        const chatContainer = card.querySelector('.chat-container');
        const chatIframe = document.createElement('iframe');
        chatIframe.src = `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${domain}`;
        chatContainer.appendChild(chatIframe);

        // UIイベントの設定
        const closeBtn = card.querySelector('.remove-stream-btn');
        closeBtn.addEventListener('click', () => {
            if(ytPlayers[uniqueId]) {
                ytPlayers[uniqueId].destroy();
                delete ytPlayers[uniqueId];
            }
            card.remove();
            streamIds = streamIds.filter(id => id !== uniqueId);
            updateGrid();
        });

        const chatToggleBtn = card.querySelector('.toggle-chat-btn');
        const streamBody = card.querySelector('.stream-body');
        
        chatToggleBtn.addEventListener('click', () => {
            streamBody.classList.toggle('has-chat');
            chatToggleBtn.classList.toggle('active');
        });
        chatToggleBtn.classList.add('active'); // 初期状態

        // タイトル設定
        card.querySelector('.stream-title').textContent = `YouTube Video (${videoId})`;

        grid.appendChild(card);
        streamIds.push(uniqueId);
        updateGrid();
        streamInput.value = '';

        // DOMに追加後、YouTube APIでプレイヤーを初期化
        // APIがまだ準備できていない場合は少し待つ
        const initPlayer = () => {
            if (typeof YT === 'undefined' || !YT.Player) {
                setTimeout(initPlayer, 100);
                return;
            }
            ytPlayers[uniqueId] = new YT.Player('player-' + uniqueId, {
                videoId: videoId,
                playerVars: {
                    'autoplay': 1,
                    'controls': 1,
                    'mute': 0
                },
                events: {
                    'onReady': (event) => {
                        // 作成完了時にグローバル音量を適用
                        event.target.setVolume(globalVolume);
                    }
                }
            });
        };
        initPlayer();
    }

    // ==========================================
    // グリッドの更新
    // ==========================================
    function updateGrid() {
        const count = streamIds.length;
        if (count === 0) {
            grid.classList.add('empty-state');
            grid.innerHTML = `
                <div class="empty-message">
                    <span class="material-icons empty-icon">video_library</span>
                    <h2>配信がありません</h2>
                    <p>上の検索バーにYouTube LiveのURLを入力して追加してください</p>
                </div>
            `;
            grid.style.gridTemplateColumns = '1fr';
        } else if (count === 1) {
            grid.style.gridTemplateColumns = '1fr';
        } else if (count === 2) {
            grid.style.gridTemplateColumns = '1fr 1fr';
        } else if (count <= 4) {
            grid.style.gridTemplateColumns = '1fr 1fr';
        } else {
            grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
            grid.classList.add('grid-many');
        }
        
        if(count <= 4) {
            grid.classList.remove('grid-many');
        }
    }

    // ==========================================
    // 一括音量コントロール
    // ==========================================
    globalVolumeSlider.addEventListener('input', (e) => {
        globalVolume = parseInt(e.target.value);
        Object.values(ytPlayers).forEach(player => {
            if (player && typeof player.setVolume === 'function') {
                player.setVolume(globalVolume);
                player.unMute();
            }
        });
        globalMuteBtn.textContent = globalVolume === 0 ? 'volume_off' : 'volume_up';
    });

    let isMuted = false;
    globalMuteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        if (isMuted) {
            globalMuteBtn.textContent = 'volume_off';
            Object.values(ytPlayers).forEach(p => p.mute && p.mute());
        } else {
            globalMuteBtn.textContent = 'volume_up';
            Object.values(ytPlayers).forEach(p => p.unMute && p.unMute());
            // ミュート解除時にスライダーの音量を再適用
            Object.values(ytPlayers).forEach(p => p.setVolume && p.setVolume(globalVolume));
        }
    });

    // ==========================================
    // UIイベントバインディング
    // ==========================================
    addBtn.addEventListener('click', () => {
        const id = extractVideoId(streamInput.value);
        if (id) addStream(id);
        else alert('有効なYouTube URLを入力してください。');
    });

    streamInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const id = extractVideoId(streamInput.value);
            if (id) addStream(id);
            else alert('有効なYouTube URLを入力してください。');
        }
    });

    layoutToggleBtn.addEventListener('click', () => {
        if(grid.style.gridTemplateColumns === '1fr') {
            grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(400px, 1fr))';
        } else {
            grid.style.gridTemplateColumns = '1fr';
        }
    });
});
