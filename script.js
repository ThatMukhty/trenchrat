const TOKEN_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

// 5 Rat Phases mapped to PNG images
const PHASES = {
  fraud: { title: "FRAUD / ZERO BALANCE", dialogue: "You hold 0 tokens! Buy on Robinhood & withdraw to your wallet!", image: "images/rat-fraud.png", color: "#dc2626" },
  starving: { title: "STARVING RAT", dialogue: "You're down bad! Buy the dip or watch me starve!", image: "images/rat-starving.png", color: "#f97316" },
  survivor: { title: "TRENCH SURVIVOR", dialogue: "Surviving in the sewer trenches. Hold strong!", image: "images/rat-survivor.png", color: "#d97706" },
  chubby: { title: "CHEESE FLEXER", dialogue: "Now we're eating good! Keep pumping!", image: "images/rat-chubby.png", color: "#eab308" },
  boss: { title: "KING OF THE SEWER", dialogue: "Look at us now! Absolute Boss of the Ethereum trenches!", image: "images/rat-boss.png", color: "#84cc16" }
};

let userWalletAddress = null;
let tokenBalance = 0;
let previousTokenBalance = 0;
let livePnl = 0;
let currentPhase = PHASES.fraud;

const minABI = [
  { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "type": "function" },
  { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "name": "", "type": "uint8" }], "type": "function" }
];

// DOM Elements
const walletModal = document.getElementById('walletModal');
const btnConnectWallet = document.getElementById('btnConnectWallet');
const btnCloseModal = document.getElementById('btnCloseModal');
const walletAddressDisplay = document.getElementById('walletAddressDisplay');
// Auto-Reconnect when loaded inside mobile dApp browser (MetaMask, Robinhood, Phantom, etc.)
document.addEventListener("DOMContentLoaded", async () => {
  if (window.ethereum) {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.listAccounts();
      if (accounts && accounts.length > 0) {
        userWalletAddress = accounts[0];
        walletAddressDisplay.innerText = `Connected: ${userWalletAddress.substring(0,6)}...${userWalletAddress.substring(38)}`;
        btnConnectWallet.innerText = "CONNECTED";
        await verifyOnChainHolding();
      }
    } catch (err) {
      console.log("Auto-connect check skipped:", err);
    }
  }
});
const statTokens = document.getElementById('statTokens');
const statPnl = document.getElementById('statPnl');
const ratImage = document.getElementById('ratImage');
const ratDialogue = document.getElementById('ratDialogue');
const phaseTitle = document.getElementById('phaseTitle');
const progressPercent = document.getElementById('progressPercent');
const progressBarFill = document.getElementById('progressBarFill');

const btnFeedRat = document.getElementById('btnFeedRat');
const eatingOverlay = document.getElementById('eatingOverlay');
const chompText = document.getElementById('chompText');

btnConnectWallet.addEventListener('click', () => walletModal.style.display = 'flex');
btnCloseModal.addEventListener('click', () => walletModal.style.display = 'none');

// Multi-Wallet Click Handler with Correct Individual Deep Links
document.querySelectorAll('.wallet-option').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    walletModal.style.display = 'none';
    const walletType = e.target.getAttribute('data-wallet');

    // If desktop extension exists, connect directly
    if (window.ethereum) {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = provider.getSigner();
        userWalletAddress = await signer.getAddress();

        walletAddressDisplay.innerText = `Connected: ${userWalletAddress.substring(0,6)}...${userWalletAddress.substring(38)}`;
        btnConnectWallet.innerText = "CONNECTED";

        await verifyOnChainHolding();
        return;
      } catch (err) {
        console.warn("Extension connection skipped or failed, using deep link handler...");
      }
    }

    // Mobile / Desktop Browser Deep Link Routing (Specific to each wallet choice)
    const targetHost = window.location.href.replace(/^https?:\/\//, '');

    if (walletType === 'metamask') {
      window.open(`https://metamask.app.link/dapp/${targetHost}`, '_blank');
    } 
    else if (walletType === 'coinbase') {
      window.open(`https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(window.location.href)}`, '_blank');
    } 
    else if (walletType === 'trust') {
      window.open(`https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(window.location.href)}`, '_blank');
    } 
    else if (walletType === 'rainbow') {
      window.open(`https://rnbw.app/dapp?url=${encodeURIComponent(window.location.href)}`, '_blank');
    } 
    else if (walletType === 'phantom') {
      window.open(`https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}`, '_blank');
    } 
    else if (walletType === 'zerion') {
      window.open(`https://zerion.io/dl/dapp/${encodeURIComponent(window.location.href)}`, '_blank');
    } 
    else if (walletType === 'rabby') {
      alert("Please install Rabby Browser Extension on desktop to connect.");
    } 
    else if (walletType === 'robinhood') {
  window.open(`https://wallet.robinhood.com/ul/browse/${encodeURIComponent(window.location.href)}`, '_blank');
}
  });
});

// Buy / Feed Action
btnFeedRat.addEventListener('click', () => {
  if (TOKEN_CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
    window.open(`https://app.uniswap.org/#/swap?outputCurrency=${TOKEN_CONTRACT_ADDRESS}`, '_blank');
  } else {
    alert("Token contract is not launched yet! Replace TOKEN_CONTRACT_ADDRESS in script.js once deployed.");
  }
});

async function verifyOnChainHolding() {
  if (!userWalletAddress || TOKEN_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    tokenBalance = 0;
    livePnl = 0;
    updateDashboardUI();
    return;
  }

  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, minABI, provider);
    const rawBalance = await contract.balanceOf(userWalletAddress);
    const decimals = await contract.decimals();

    const fetchedBalance = parseFloat(ethers.utils.formatUnits(rawBalance, decimals));

    if (previousTokenBalance > 0 && fetchedBalance > previousTokenBalance) {
      const addedTokens = (fetchedBalance - previousTokenBalance).toFixed(0);
      triggerEatingAnimation(addedTokens);
    }

    previousTokenBalance = fetchedBalance;
    tokenBalance = fetchedBalance;

    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_CONTRACT_ADDRESS}`);
    const data = await res.json();
    if (data.pairs && data.pairs.length > 0) {
      livePnl = parseFloat(data.pairs[0].priceChange.h24) || 0;
    }

    updateDashboardUI();
  } catch (err) {
    console.error("Verification error:", err);
    updateDashboardUI();
  }
}

function triggerEatingAnimation(amountText) {
  chompText.innerText = `CHOMP! FED +${amountText} TOKENS!`;
  eatingOverlay.style.display = 'flex';
  ratImage.classList.add('eating-bounce');

  setTimeout(() => {
    eatingOverlay.style.display = 'none';
    ratImage.classList.remove('eating-bounce');
  }, 2500);
}

function updateDashboardUI() {
  statTokens.innerText = tokenBalance.toFixed(2);
  statPnl.innerText = `${livePnl >= 0 ? '+' : ''}${livePnl.toFixed(1)}%`;

  if (tokenBalance <= 0) {
    currentPhase = PHASES.fraud;
  } else if (livePnl <= -30) {
    currentPhase = PHASES.starving;
  } else if (livePnl <= 10) {
    currentPhase = PHASES.survivor;
  } else if (livePnl <= 100) {
    currentPhase = PHASES.chubby;
  } else {
    currentPhase = PHASES.boss;
  }

  ratImage.src = currentPhase.image;
  ratDialogue.innerText = `"${currentPhase.dialogue}"`;
  phaseTitle.innerText = `PHASE: ${currentPhase.title}`;

  let fillVal = tokenBalance <= 0 ? 0 : Math.min(Math.max(((livePnl + 100) / 200) * 100, 10), 100);
  progressBarFill.style.width = `${fillVal}%`;
  progressBarFill.style.backgroundColor = currentPhase.color;
  progressPercent.innerText = `${fillVal.toFixed(0)}%`;
}

// Download Card Directly as PNG
document.getElementById('btnDownload').addEventListener('click', () => {
  const canvas = document.getElementById('cardCanvas');
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0c0a07';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = currentPhase.color;
  ctx.lineWidth = 10;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.fillStyle = '#eab308';
  ctx.font = 'bold 50px Courier New';
  ctx.fillText('TRENCH RAT STATUS', 60, 100);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Courier New';
  ctx.fillText(`PHASE: ${currentPhase.title}`, 60, 180);

  ctx.fillStyle = currentPhase.color;
  ctx.fillText(`VERIFIED HOLDINGS: ${tokenBalance.toFixed(2)} TOKENS`, 60, 240);

  ctx.fillStyle = '#1a1610';
  ctx.fillRect(60, 320, 1080, 180);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic 30px Courier New';
  ctx.fillText(`"${currentPhase.dialogue}"`, 90, 420);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '22px Courier New';
  ctx.fillText('ROBINHOOD LAUNCH • ETHEREUM SEWER DAPP', 60, 570);

  const link = document.createElement('a');
  link.download = 'trench-rat-status.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// Share to X
document.getElementById('btnShare').addEventListener('click', () => {
  const text = `My Trench Rat status: [${currentPhase.title}].\n\nIt told me: "${currentPhase.dialogue}"\n\nVerify yours on Ethereum:`;
  window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
});

// Initial Render
updateDashboardUI();
// CA Copy & Robinhood Action Handlers
const btnCopyCA = document.getElementById('btnCopyCA');
const btnOpenRobinhood = document.getElementById('btnOpenRobinhood');

if (btnCopyCA) {
  btnCopyCA.addEventListener('click', () => {
    // Copy the token contract address
    navigator.clipboard.writeText(TOKEN_CONTRACT_ADDRESS).then(() => {
      btnCopyCA.innerText = "COPIED! 🧀";
      btnCopyCA.style.background = "#84cc16";

      // Show the Robinhood redirection button immediately!
      if (btnOpenRobinhood) {
        btnOpenRobinhood.style.display = "block";
      }

      setTimeout(() => {
        btnCopyCA.innerText = "COPY CA 📋";
        btnCopyCA.style.background = "#eab308";
      }, 3000);
    }).catch(err => {
      console.error("Failed to copy:", err);
    });
  });
}

// Redirect to Robinhood App / Web
if (btnOpenRobinhood) {
  btnOpenRobinhood.addEventListener('click', () => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      // Deep link to Robinhood Wallet App
      window.location.href = "https://wallet.robinhood.com/";
    } else {
      // Desktop fallback to Robinhood Crypto Web
      window.open("https://robinhood.com/us/en/about/crypto/", "_blank");
    }
  });
}