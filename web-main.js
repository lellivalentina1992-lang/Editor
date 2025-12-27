// Configurazione API
const API_URL = 'http://138.199.196.24/api'; //  IL TUO IP

class VideoEditorWeb {
    constructor() {
        this.tracks = [];
        this.selectedTrackId = null;
        this.cursorPosition = 0;
        this.init();
    }

    init() {
        console.log(' Video Editor Web inizializzato');
        this.setupEventListeners();
        this.updateDisplay();
    }

    setupEventListeners() {
        // File input
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });

        // Timeline click
        document.getElementById('timelineTrack').addEventListener('click', (e) => {
            const rect = e.target.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            const maxDuration = Math.max(...this.tracks.map(t => t.duration || 0), 300);
            this.cursorPosition = percent * maxDuration;
            this.updateDisplay();
        });

        // Drag & Drop
        document.body.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.body.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleFileUpload(e.dataTransfer.files);
        });
    }

    async handleFileUpload(files) {
        for (const file of files) {
            await this.uploadFile(file);
        }
    }

    async uploadFile(file) {
        try {
            this.updateStatus(` Upload ${file.name}...`);

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload fallito');
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Upload fallito');
            }

            // Crea traccia
            const track = {
                id: data.fileId,
                name: data.originalName,
                filePath: data.filePath,
                size: data.size,
                duration: data.duration || 0,
                type: this.getFileType(data.originalName),
                volume: 1.0,
                effects: {},
            };

            this.tracks.push(track);
            this.updateStatus(` ${file.name} caricato!`);
            this.renderTracks();

        } catch (error) {
            this.updateStatus(` Errore: ${error.message}`, true);
            console.error('Upload error:', error);
        }
    }

    getFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];
        return audioExts.includes(ext) ? 'audio' : 'video';
    }

    renderTracks() {
        const container = document.getElementById('tracksSection');
        
        if (this.tracks.length === 0) {
            container.innerHTML = '<div class="tracks-empty">Nessuna traccia<br>Clicca "Carica File" per iniziare</div>';
            return;
        }

        container.innerHTML = this.tracks.map((track, index) => `
            <div class="track-item ${this.selectedTrackId === track.id ? 'selected' : ''}" 
                 onclick="app.selectTrack('${track.id}')">
                <div class="track-name">${track.type === 'audio' ? '' : ''} ${track.name}</div>
                
                <div class="track-info">
                    <div class="track-info-row">
                        <span class="track-info-label">Tipo:</span>
                        <span class="track-info-value">${track.type.toUpperCase()}</span>
                    </div>
                    <div class="track-info-row">
                        <span class="track-info-label">Durata:</span>
                        <span class="track-info-value">${this.formatTime(track.duration)}</span>
                    </div>
                    <div class="track-info-row">
                        <span class="track-info-label">Dimensione:</span>
                        <span class="track-info-value">${this.formatBytes(track.size)}</span>
                    </div>
                    <div class="track-info-row">
                        <span class="track-info-label">Volume:</span>
                        <span class="track-info-value">${Math.round(track.volume * 100)}%</span>
                    </div>
                </div>
                
                <div class="track-actions">
                    ${track.type === 'audio' ? `
                        <button class="track-btn" onclick="event.stopPropagation(); app.openEffects('${track.id}')">
                             Effetti
                        </button>
                    ` : ''}
                    <button class="track-btn" onclick="event.stopPropagation(); app.openConvert('${track.id}')">
                         Converti
                    </button>
                    <button class="track-btn" onclick="event.stopPropagation(); app.deleteTrack('${track.id}')">
                        Elimina
                    </button>
                </div>
                
                <div class="progress-container" id="progress-${track.id}">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progress-fill-${track.id}"></div>
                    </div>
                    <div class="progress-text" id="progress-text-${track.id}"></div>
                </div>
            </div>
        `).join('');

        this.updateDisplay();
    }

    selectTrack(trackId) {
        this.selectedTrackId = trackId;
        this.renderTracks();
    }

    deleteTrack(trackId) {
        if (confirm('Eliminare questa traccia?')) {
            const track = this.tracks.find(t => t.id === trackId);
            
            if (track && track.filePath) {
                fetch(`${API_URL}/file/${encodeURIComponent(track.filePath)}`, {
                    method: 'DELETE',
                }).catch(e => console.warn('Errore eliminazione:', e));
            }

            this.tracks = this.tracks.filter(t => t.id !== trackId);
            if (this.selectedTrackId === trackId) {
                this.selectedTrackId = null;
            }
            this.renderTracks();
        }
    }

    openEffects(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (!track) return;

        this.selectedTrackId = trackId;

        const dialog = document.getElementById('effectsDialog');
        const content = document.getElementById('effectsContent');

        content.innerHTML = `
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Volume (${Math.round((track.effects.volume || 1.0) * 100)}%)</label>
                <input type="range" id="effect-volume" min="0" max="200" value="${(track.effects.volume || 1.0) * 100}" 
                       oninput="this.nextElementSibling.textContent = this.value + '%'">
                <span>${Math.round((track.effects.volume || 1.0) * 100)}%</span>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label>
                    <input type="checkbox" id="effect-normalize" ${track.effects.normalize ? 'checked' : ''}>
                    Normalizza Audio
                </label>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label>
                    <input type="checkbox" id="effect-bassboost" ${track.effects.bassBoost ? 'checked' : ''}>
                    Bass Boost
                </label>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label>
                    <input type="checkbox" id="effect-echo" ${track.effects.echo ? 'checked' : ''}>
                    Echo
                </label>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Fade In (secondi)</label>
                <input type="number" id="effect-fadein" min="0" max="10" step="0.5" 
                       value="${track.effects.fadeIn || 0}" style="width: 100%;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Fade Out (secondi)</label>
                <input type="number" id="effect-fadeout" min="0" max="10" step="0.5" 
                       value="${track.effects.fadeOut || 0}" style="width: 100%;">
            </div>
        `;

        dialog.showModal();
    }

    async applyEffects() {
        const track = this.tracks.find(t => t.id === this.selectedTrackId);
        if (!track) return;

        const effects = {
            volume: parseFloat(document.getElementById('effect-volume').value) / 100,
            normalize: document.getElementById('effect-normalize').checked,
            bassBoost: document.getElementById('effect-bassboost').checked,
            echo: document.getElementById('effect-echo').checked,
            fadeIn: parseFloat(document.getElementById('effect-fadein').value) || 0,
            fadeOut: parseFloat(document.getElementById('effect-fadeout').value) || 0,
            fadeOutStart: track.duration - (parseFloat(document.getElementById('effect-fadeout').value) || 0),
        };

        document.getElementById('effectsDialog').close();

        try {
            this.showProgress(track.id, 'Applicazione effetti...');

            const response = await fetch(`${API_URL}/audio-effects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filePath: track.filePath,
                    effects,
                }),
            });

            if (!response.ok) throw new Error('Processamento fallito');

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            track.effects = effects;
            track.processedId = data.outputId;

            this.hideProgress(track.id);
            this.updateStatus(' Effetti applicati! Scarico file...');

            this.downloadFile(data.outputId, track.name);

        } catch (error) {
            this.hideProgress(track.id);
            this.updateStatus(` Errore: ${error.message}`, true);
            console.error('Effects error:', error);
        }
    }

    openConvert(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (!track) return;

        this.selectedTrackId = trackId;
        document.getElementById('convertFileName').textContent = track.name;
        
        // Se è audio, mostra opzione per video
        if (track.type === 'audio') {
            document.getElementById('audioToVideoOption').style.display = 'block';
        } else {
            document.getElementById('audioToVideoOption').style.display = 'none';
            document.getElementById('audioToVideoMode').value = 'none';
        }
        
        this.updateConvertOptions();
        document.getElementById('convertDialog').showModal();
    }

    updateConvertOptions() {
        const track = this.tracks.find(t => t.id === this.selectedTrackId);
        const videoMode = document.getElementById('audioToVideoMode').value;
        const formatSelect = document.getElementById('convertFormat');
        const imageUploadSection = document.getElementById('imageUploadSection');
        const videoUploadSection = document.getElementById('videoUploadSection');
        const slideshowOptions = document.getElementById('slideshowOptions');
        const videoMergeOptions = document.getElementById('videoMergeOptions');
        
        // Reset display
        imageUploadSection.style.display = 'none';
        videoUploadSection.style.display = 'none';
        slideshowOptions.style.display = 'none';
        videoMergeOptions.style.display = 'none';
        
        if (videoMode === 'static' || videoMode === 'slideshow' || videoMode === 'background') {
            // Mostra solo formati video
            formatSelect.innerHTML = `
                <option value="mp4">MP4</option>
                <option value="mkv">MKV</option>
                <option value="avi">AVI</option>
                <option value="mov">MOV</option>
            `;
            
            if (videoMode === 'static') {
                imageUploadSection.style.display = 'block';
                const imageInput = document.getElementById('imageFileInput');
                imageInput.removeAttribute('multiple');
                
            } else if (videoMode === 'slideshow') {
                imageUploadSection.style.display = 'block';
                slideshowOptions.style.display = 'block';
                const imageInput = document.getElementById('imageFileInput');
                imageInput.setAttribute('multiple', '');
                
            } else if (videoMode === 'background') {
                videoUploadSection.style.display = 'block';
                videoMergeOptions.style.display = 'block';
            }
        } else {
            // Conversione normale
            if (track.type === 'audio') {
                formatSelect.innerHTML = `
                    <option value="mp3">MP3</option>
                    <option value="wav">WAV</option>
                    <option value="flac">FLAC</option>
                    <option value="m4a">M4A</option>
                `;
            } else {
                formatSelect.innerHTML = `
                    <option value="mp4">MP4</option>
                    <option value="mkv">MKV</option>
                    <option value="avi">AVI</option>
                    <option value="mov">MOV</option>
                    <option value="mp3">MP3 (solo audio)</option>
                    <option value="wav">WAV (solo audio)</option>
                `;
            }
        }
    }

    async convertFile() {
        const track = this.tracks.find(t => t.id === this.selectedTrackId);
        if (!track) return;

        const format = document.getElementById('convertFormat').value;
        const videoMode = document.getElementById('audioToVideoMode')?.value;
        
        document.getElementById('convertDialog').close();

        try {
            if (videoMode === 'static' || videoMode === 'slideshow' || videoMode === 'background') {
                const formData = new FormData();
                
                // Recupera file audio dal server
                const audioBlob = await this.getFileBlob(track.filePath);
                formData.append('audio', audioBlob, track.name);
                formData.append('format', format);
                
                if (videoMode === 'background') {
                    // VIDEO BACKGROUND
                    const videoInput = document.getElementById('videoFileInput');
                    if (!videoInput.files || videoInput.files.length === 0) {
                        this.updateStatus('Errore: Seleziona almeno un video', true);
                        return;
                    }

                    this.showProgress(track.id, `Unione audio con ${videoInput.files.length} video...`);
                    
                    for (let i = 0; i < videoInput.files.length; i++) {
                        formData.append('videos', videoInput.files[i]);
                    }
                    
                    const videoMergeMode = document.getElementById('videoMergeMode').value || 'loop';
                    formData.append('videoMode', videoMergeMode);
                    formData.append('replaceAudio', 'true');

                    const response = await fetch(`${API_URL}/audio-video-merge`, {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) throw new Error('Merge fallito');

                    const data = await response.json();
                    if (!data.success) throw new Error(data.error);

                    this.hideProgress(track.id);
                    this.updateStatus(`Video con audio creato! Scarico...`);

                    const newName = track.name.replace(/\.[^.]+$/, `_video.${format}`);
                    this.downloadFile(data.outputId, newName);
                    
                } else if (videoMode === 'slideshow') {
                    // SLIDESHOW
                    const imageInput = document.getElementById('imageFileInput');
                    if (!imageInput.files || imageInput.files.length === 0) {
                        this.updateStatus('Errore: Seleziona almeno un\'immagine', true);
                        return;
                    }

                    this.showProgress(track.id, `Creazione slideshow con ${imageInput.files.length} immagini...`);
                    
                    for (let i = 0; i < imageInput.files.length; i++) {
                        formData.append('images', imageInput.files[i]);
                    }
                    
                    const imageDuration = document.getElementById('imageDuration').value || 5;
                    const transition = document.getElementById('transitionType').value || 'fade';
                    formData.append('imageDuration', imageDuration);
                    formData.append('transition', transition);

                    const response = await fetch(`${API_URL}/audio-to-video-slideshow`, {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) throw new Error('Conversione fallita');

                    const data = await response.json();
                    if (!data.success) throw new Error(data.error);

                    this.hideProgress(track.id);
                    this.updateStatus(`Slideshow creato! Scarico...`);

                    const newName = track.name.replace(/\.[^.]+$/, `_slideshow.${format}`);
                    this.downloadFile(data.outputId, newName);
                    
                } else {
                    // IMMAGINE STATICA
                    const imageInput = document.getElementById('imageFileInput');
                    if (!imageInput.files || imageInput.files.length === 0) {
                        this.updateStatus('Errore: Seleziona un\'immagine', true);
                        return;
                    }

                    this.showProgress(track.id, `Creazione video con immagine...`);
                    
                    formData.append('image', imageInput.files[0]);

                    const response = await fetch(`${API_URL}/audio-to-video`, {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) throw new Error('Conversione fallita');

                    const data = await response.json();
                    if (!data.success) throw new Error(data.error);

                    this.hideProgress(track.id);
                    this.updateStatus(`Convertito in video ${format.toUpperCase()}! Scarico...`);

                    const newName = track.name.replace(/\.[^.]+$/, `.${format}`);
                    this.downloadFile(data.outputId, newName);
                }

            } else {
                // CONVERSIONE NORMALE
                this.showProgress(track.id, `Conversione in ${format.toUpperCase()}...`);

                const response = await fetch(`${API_URL}/convert`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filePath: track.filePath,
                        format,
                    }),
                });

                if (!response.ok) throw new Error('Conversione fallita');

                const data = await response.json();
                if (!data.success) throw new Error(data.error);

                this.hideProgress(track.id);
                this.updateStatus(`Convertito in ${format.toUpperCase()}! Scarico...`);

                const newName = track.name.replace(/\.[^.]+$/, `.${format}`);
                this.downloadFile(data.outputId, newName);
            }

        } catch (error) {
            this.hideProgress(track.id);
            this.updateStatus(`Errore: ${error.message}`, true);
            console.error('Convert error:', error);
        }
    }

    async getFileBlob(filePath) {
        const response = await fetch(`${API_URL}/file-download/${encodeURIComponent(filePath)}`);
        if (!response.ok) throw new Error('File non trovato sul server');
        return await response.blob();
    }

    downloadFile(outputId, filename) {
        const downloadUrl = `${API_URL}/download/${outputId}`;
        
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        this.updateStatus(' Download avviato!');
    }

    showProgress(trackId, message) {
        const container = document.getElementById(`progress-${trackId}`);
        const text = document.getElementById(`progress-text-${trackId}`);
        if (container && text) {
            container.style.display = 'block';
            text.textContent = message;
        }
    }

    hideProgress(trackId) {
        const container = document.getElementById(`progress-${trackId}`);
        if (container) {
            container.style.display = 'none';
        }
    }

    updateDisplay() {
        const maxDuration = Math.max(...this.tracks.map(t => t.duration || 0), 300);
        const percent = (this.cursorPosition / maxDuration) * 100;
        document.getElementById('timelineCursor').style.left = `${percent}%`;

        document.getElementById('currentTime').textContent = this.formatTime(this.cursorPosition);
        document.getElementById('duration').textContent = this.formatTime(maxDuration);
    }

    updateStatus(message, isError = false) {
        const statusEl = document.getElementById('statusText');
        statusEl.textContent = message;
        statusEl.style.color = isError ? '#f85149' : '#c9d1d9';
        
        const announcer = document.getElementById('statusAnnouncer');
        announcer.textContent = message;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

// Inizializza app
const app = new VideoEditorWeb();
window.app = app;

console.log(' Video Editor Web - Versione Completa');
console.log('API URL:', API_URL);
console.log(' Storage locale - niente cloud');