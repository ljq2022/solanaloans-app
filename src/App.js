import React, { useEffect, useState } from "react";
import "./App.css";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Program, Provider, web3 } from "@project-serum/anchor";
import idl from "./idl.json";
import kp from "./keypair.json";

// SystemProgram is a reference to the Solana runtime!
const { SystemProgram, Keypair } = web3;

// Create a keypair for the account that will hold the loan account data.
const arr = Object.values(kp._keypair.secretKey);
const secret = new Uint8Array(arr);
const baseAccount = Keypair.fromSecretKey(secret);

// Get our program's id from the IDL file.
const programID = new PublicKey(idl.metadata.address);

// Set our network to devnet.
const network = clusterApiUrl("devnet");

// Controls how we want to acknowledge when a transaction is "done".
const opts = {
  preflightCommitment: "processed",
};

const App = () => {
  // State
  const [walletAddress, setWalletAddress] = useState(null);
  const [accountData, setAccountData] = useState("");
  const [mostRecentLoan, setMostRecentLoan] = useState(null);

  // Actions
  const checkIfWalletIsConnected = async () => {
    try {
      const { solana } = window;

      if (solana) {
        if (solana.isPhantom) {
          console.log("Phantom wallet found!");
          const response = await solana.connect({ onlyIfTrusted: true });
          console.log(
            "Connected with Public Key:",
            response.publicKey.toString()
          );

          /*
           * Set the user's publicKey in state to be used later!
           */
          setWalletAddress(response.publicKey.toString());
        }
      } else {
        alert("Solana object not found! Get a Phantom Wallet 👻");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const connectWallet = async () => {
    const { solana } = window;

    if (solana) {
      const response = await solana.connect();
      console.log("Connected with Public Key:", response.publicKey.toString());
      setWalletAddress(response.publicKey.toString());
    }
  };

  const renderNotConnectedContainer = () => (
    <button
      className="cta-button connect-wallet-button"
      onClick={connectWallet}
    >
      Connect to Wallet
    </button>
  );

  const createLoan = async () => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);

      await program.rpc.createLoan({
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
      });
      console.log("Loan successfully created.");

      await getAccountData();
    } catch (error) {
      console.log("Error creating loan:", error);
    }
  };

  const payLoan = async () => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);

      await program.rpc.payLoan({
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
      });
      console.log("Loan successfully paid.");

      await getAccountData();
    } catch (error) {
      console.log("Error paying loan:", error);
    }
  };

  const createLoanAccount = async () => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      console.log("ping");
      await program.rpc.initialize({
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [baseAccount],
      });
      console.log(
        "Created a new BaseAccount w/ address:",
        baseAccount.publicKey.toString()
      );
      getAccountData();
    } catch (error) {
      console.log("Error creating BaseAccount account:", error);
    }
  };

  const renderConnectedCreateLoanContainer = () => {
    // If we hit this, it means the program account hasn't been initialized.
    if (accountData === null) {
      return (
        <div className="connected-container">
          <button
            className="cta-button submit-gif-button"
            onClick={createLoanAccount}
          >
            Do One-Time Initialization For Loan Program Account
          </button>
        </div>
      );
    }
    // Otherwise, we're good! Account exists. User can create loans
    else if (!mostRecentLoan || mostRecentLoan.isPaid) {
      return (
        <div className="connected-container">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createLoan();
            }}
          >
            {
              <button type="submit" className="cta-button submit-gif-button">
                Create Loan
              </button>
            }
          </form>
        </div>
      );
    } else {
      return (
        <div className="connected-container">
          You haven't paid back your most recent loan.
        </div>
      );
    }
  };

  const renderConnectedPayLoanContainer = () => {
    // If we hit this, it means the program account hasn't been initialized.
    if (mostRecentLoan && !mostRecentLoan.isPaid) {
      return (
        <div className="connected-container">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              payLoan();
            }}
          >
            {
              <button type="submit" className="cta-button submit-gif-button">
                Pay Loan
              </button>
            }
          </form>
        </div>
      );
    } else {
      return (
        <div className="connected-container">
          You have no outstanding loan to pay.
        </div>
      );
    }
  };
  const getProvider = () => {
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new Provider(
      connection,
      window.solana,
      opts.preflightCommitment
    );
    return provider;
  };

  // UseEffects
  useEffect(() => {
    const onLoad = async () => {
      await checkIfWalletIsConnected();
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  const getAccountData = async () => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      const account = await program.account.baseAccount.fetch(
        baseAccount.publicKey
      );

      console.log("Got the account", account);
      setAccountData(account);
      if (account && account.users) {
        const filterForUserArr = account.users.filter(
          (user) => user.key.toString() === walletAddress
        );
        if (filterForUserArr && filterForUserArr.length > 0) {
          const user = filterForUserArr[0];
          if (user.loans && user.loans.length > 0) {
            setMostRecentLoan(user.loans[user.loans.length - 1]);
          }
        }
      }
    } catch (error) {
      console.log("Error in getAccountData: ", error);
      setAccountData(null);
    }
  };

  useEffect(() => {
    if (walletAddress) {
      console.log("Fetching Loan Account...");
      // eslint-disable-next-line react-hooks/exhaustive-deps
      getAccountData();
    }
  }, [walletAddress]);

  return (
    <div className="App">
      <div className="container">
        <div className="header-container">
          <p className="header">Loan Portal</p>
          <p className="sub-text">Take out a loan</p>
          {!walletAddress && renderNotConnectedContainer()}
          {/* We just need to add the inverse here! */}
          {walletAddress && renderConnectedCreateLoanContainer()}
          {walletAddress && renderConnectedPayLoanContainer()}
        </div>
      </div>
    </div>
  );
};

export default App;
