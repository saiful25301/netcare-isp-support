class ModalService {
  constructor() {
    this.container = document.getElementById('modal-container');
  }

  open({ title, content, footerButtons = [] }) {
    if (!this.container) {
      this.container = document.getElementById('modal-container');
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const modalBox = document.createElement('div');
    modalBox.className = 'modal-box';

    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `
      <h3 class="text-md font-bold">${title}</h3>
      <button class="btn btn-outline btn-sm modal-close-btn" style="padding: 0.2rem 0.5rem;">✕</button>
    `;

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else {
      body.appendChild(content);
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    footerButtons.forEach(btnConfig => {
      const btn = document.createElement('button');
      btn.className = `btn ${btnConfig.className || 'btn-outline'}`;
      btn.textContent = btnConfig.text;
      btn.onclick = (e) => {
        if (btnConfig.onClick) {
          btnConfig.onClick(this.close.bind(this), e);
        } else {
          this.close();
        }
      };
      footer.appendChild(btn);
    });

    modalBox.appendChild(header);
    modalBox.appendChild(body);
    if (footerButtons.length > 0) {
      modalBox.appendChild(footer);
    }

    backdrop.appendChild(modalBox);
    this.container.innerHTML = '';
    this.container.appendChild(backdrop);

    // Close listeners
    header.querySelector('.modal-close-btn').onclick = () => this.close();
    backdrop.onclick = (e) => {
      if (e.target === backdrop) this.close();
    };

    return modalBox;
  }

  close() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

export const modal = new ModalService();
