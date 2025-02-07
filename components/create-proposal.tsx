import {useContext, useEffect, useState} from 'react';
import Modal from './modal';
import ReactSelect from './react-select';
import CreateProposalDistributionItem from './create-proposal-distribution-item';
import sumObj from 'helpers/sumObj';
import {BeproService} from '@services/bepro-service';
import {pullRequest} from 'interfaces/issue-data';
import {ApplicationContext} from '@contexts/application';
import {addTransaction} from '@reducers/add-transaction';
import {TransactionTypes} from '@interfaces/enums/transaction-types';
import {updateTransaction} from '@reducers/update-transaction';
import {toastWarning} from '@reducers/add-toast';
import Button from './button';
import {useRouter} from 'next/router';
import useOctokit from '@x-hooks/use-octokit';
import useRepos from '@x-hooks/use-repos';
import useApi from '@x-hooks/use-api';
import {TransactionStatus} from '@interfaces/enums/transaction-status';
import useTransactions from '@x-hooks/useTransactions';
import LockedIcon from '@assets/icons/locked-icon';
import clsx from 'clsx';
import { Proposal } from '@interfaces/proposal';
import { ProposalData } from '@interfaces/api-response';
import { useTranslation } from 'next-i18next';
import Avatar from './avatar';
import PullRequestLabels, {PRLabel} from './pull-request-labels';

interface participants {
  githubHandle: string;
  address?: string;
}

interface SameProposal {
  currentPrId: number;
  prAddressAmount: {
    amount: number;
    address: string;
  }[];
}

function getLabel(data): PRLabel{
  if(data.merged) return 'merged';
  if(data.isMergeable) return 'ready to merge';
  //isMergeable can be null;
  if(data.isMergeable === false) return 'conflicts';
}

function SelectValueComponent({ innerProps, innerRef, ...rest }){
  const data = rest.getValue()[0];
  const label = getLabel(data)

  return (
    <div
      ref={innerRef}
      {...innerProps}
      className="proposal__select-options d-flex align-items-center text-center p-small p-1"
    >
      <Avatar userLogin={data?.githubLogin} />
      <span className="ml-1 text-nowrap">
        {data?.label}
      </span>
      <div className="ms-2">
        {label && <PullRequestLabels label={label}/>}
      </div>
    </div>
  )
}

function SelectOptionComponent({ innerProps, innerRef, data }) {
  const label = getLabel(data)
  return (
    <div
      ref={innerRef}
      {...innerProps}
      className="proposal__select-options d-flex align-items-center text-center p-small p-1"
    >
      <Avatar userLogin={data?.githubLogin} />
      <span className={`ml-1 text-nowrap ${data.isDisable ? 'text-ligth-gray': 'text-gray hover-primary'}`}>
        {data?.label}
      </span>
      <div className="d-flex flex-grow-1 justify-content-end">
        {label && <PullRequestLabels label={label}/>}
      </div>
    </div>
  );
}

export default function NewProposal({
                                      issueId,
                                      amountTotal,
                                      mergeProposals,
                                      pullRequests = [],
                                      handleBeproService,
                                      handleMicroService,
                                      isIssueOwner = false, isFinished = false
                                    }) {
  const {dispatch, state: {balance, currentAddress, beproInit, oracles, githubLogin},} = useContext(ApplicationContext);
  const [distrib, setDistrib] = useState<Object>({});
  const [amount, setAmount] = useState<number>();
  const [currentPullRequest, setCurrentPullRequest] = useState<pullRequest>({} as pullRequest)
  const [error, setError] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [warning, setWarning] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [participants, setParticipants] = useState<participants[]>([]);
  const [isCouncil, setIsCouncil] = useState(false);
  const [councilAmount, setCouncilAmount] = useState(0);
  const [currentGithubId, setCurrentGithubId] = useState<string>();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const router = useRouter();
  const [[activeRepo]] = useRepos();
  const {getParticipants} = useOctokit();
  const {getUserWith, waitForMerge, processMergeProposal, processEvent} = useApi();
  const txWindow = useTransactions();
  const { t } = useTranslation(['common', 'bounty', 'proposal', 'pull-request'])
  const [showExceptionalMessage, setShowExceptionalMessage] = useState<boolean>();


  function handleChangeDistrib(params: { [key: string]: number }): void {
    setDistrib((prevState) => {
      handleCheckDistrib({
        ...prevState,
        ...params,
        })
      return({
      ...prevState,
      ...params,
      })
  });
  }

  async function loadProposalsMeta() {
    if (!issueId)
      return;

    const scIssueId = await BeproService.network.getIssueByCID({issueCID: issueId}).then(({_id}) => _id);
    const pool = [];

    for (const meta of mergeProposals as ProposalData[]) {
      const { scMergeId, pullRequestId } = meta;
      if (scMergeId) {
        const merge = await BeproService.network.getMergeById({merge_id: scMergeId, issue_id: scIssueId});
        pool.push({...merge, pullRequestId } as Proposal)
      }
    }

    setProposals(pool);
  }

  function isSameProposal(
    currentDistrbuition: SameProposal,
    currentProposals: SameProposal[]
  ) {
    return currentProposals.some((activeProposal) => {
      if (
        activeProposal.currentPrId === currentDistrbuition.currentPrId
      ) {
        return activeProposal.prAddressAmount.every((ap) =>
          currentDistrbuition.prAddressAmount.find(
            (p) => ap.amount === p.amount && ap.address === p.address
          )
        );
      } else {
        return false;
      }
    });
  }

  function handleCheckDistrib(obj: object) {
    var currentAmount = sumObj(obj)

    if (currentAmount === 100){
     const { id }  = pullRequests.find(
        (data) => data.githubId === currentGithubId
      )

      var currentDistrbuition = {
        currentPrId: id,
        prAddressAmount: participants.map(
          (item) =>  ({
            amount: ((amountTotal * obj[item.githubHandle])/100),
            address: item.address.toLowerCase()
          })
        )
      }
      
      var currentProposals = proposals.map((item) => {
        return ({
            currentPrId: Number(item.pullRequestId),
            prAddressAmount: item.prAddresses.map((value, key) => ({
              amount: Number(item.prAmounts[key]),
              address: value.toLowerCase()
            }))
          })
         })

      if(isSameProposal(currentDistrbuition, currentProposals)){
        handleInputColor("warning")
      }else {
        handleInputColor("success")
      } 
   }
   if (currentAmount > 0 && currentAmount < 100 || currentAmount > 100){
    handleInputColor("error")
   }
   if (currentAmount === 0){
    handleInputColor("normal")
   }

   if(currentAmount === 100){
    participants.map(item => {
      var realValue = (amountTotal * obj[item.githubHandle])/ 100
      if(amountTotal < participants.length && realValue < 1 && realValue != 0 && realValue < amountTotal){
        handleInputColor("error")
        setShowExceptionalMessage(true)
      }
    })
   }
  }

  function handleInputColor ( name: string ) {
    if(name === "success"){
      setError(false)
      setSuccess(true)
      setWarning(false)
    }
    if(name === "error"){
      setError(true)
      setSuccess(false)
      setWarning(false)
    }
    if(name === "warning"){
      setError(false)
      setSuccess(false)
      setWarning(true)
    }
    if(name === "normal"){
      setError(false)
      setSuccess(false)
      setWarning(false)
    }
  }

  function getParticipantsPullRequest(id: string, githubId: string) {
    if (!activeRepo)
      return;

    getParticipants(+githubId, activeRepo.githubPath)
      .then(participants => {
        const tmpParticipants = [...participants]

        pullRequests?.find(pr => pr.githubId === githubId)?.reviewers?.forEach(participant => {
          if (!tmpParticipants.includes(participant)) tmpParticipants.push(participant)
        })

        return Promise.all(tmpParticipants.map(async login => {
          const {address, githubLogin, githubHandle} = await getUserWith(login);
          return {address, githubLogin, githubHandle};
        }))
      })
      .then((participantsPr) => {
        const tmpParticipants = participantsPr.filter(({address}) => !!address);
        setDistrib(Object.fromEntries(tmpParticipants.map(participant => [participant.githubHandle, 0])))
        setCurrentGithubId(githubId);       
        setParticipants(tmpParticipants);
      })
      .catch((err) => {
        console.error('Error fetching pullRequestsParticipants', err)
      });
  }

  async function handleClickCreate(): Promise<void> {
    const issue_id = await BeproService.network.getIssueByCID({issueCID: issueId}).then(({_id}) => _id);
    
    // NOTE:
    //`payload.prAmmounts` need be Intenger number, because the contract remove numbers after dot using `toFix(0)`;
    // To fix it, we check the difference between amount distributed and amount total, and attributed the rest to last participant;

    function handleValues(amount, distributed){
      return Math.floor((amount * distributed) / 100)
    }

    var prAddresses: string[] = []
    var prAmounts: number[] = []

    participants.map((items) => {
      if(handleValues(amountTotal,distrib[items.githubHandle]) > 0){
        prAddresses.push(items.address)
        prAmounts.push(handleValues(amountTotal,distrib[items.githubHandle]))
      }
    })
  
    const payload = {
      issueID: issue_id,
      prAddresses,
      prAmounts,
    };
    //Chcking diff between total Distributed and total Ammount;
    const totalDistributed = payload.prAmounts.reduce((p,c)=> p+c)
    // Assigning the rest to last participant;
    payload.prAmounts[payload.prAmounts.length - 1] += Math.ceil((amountTotal - totalDistributed))
    
    setShow(false);

    const proposeMergeTx = addTransaction({type: TransactionTypes.proposeMerge})
    dispatch(proposeMergeTx);

    waitForMerge(githubLogin, issue_id, currentGithubId)
                      .then(() => {
                        if (handleBeproService)
                          handleBeproService(true);

                        if (handleMicroService)
                          handleMicroService(true);
                        handleClose();
                        setDistrib({});
                      })

    await BeproService.network
                      .proposeIssueMerge(payload)
                      .then(txInfo => {
                        processEvent(`merge-proposal`, txInfo.blockNumber, issue_id, currentGithubId);

                        txWindow.updateItem(proposeMergeTx.payload.id, BeproService.parseTransaction(txInfo, proposeMergeTx.payload));

                        handleClose();
                      })
                      .catch((e) => {
                        if (e?.message?.search(`User denied`) > -1)
                          dispatch(updateTransaction({...proposeMergeTx.payload as any, remove: true}))
                        else dispatch(updateTransaction({...proposeMergeTx.payload as any, status: TransactionStatus.failed}));
                        handleClose();
                      })                    
  }

  function handleClose() {
    if (pullRequests.length && activeRepo)
      getParticipantsPullRequest(pullRequests[0]?.id, pullRequests[0]?.githubId)
      setCurrentGithubId(pullRequests[0]?.githubId)

    setShow(false);
    setAmount(0);
    setDistrib({});
    handleInputColor("normal")
  }

  function handleChangeSelect({ value, githubId }) {
    setDistrib({});
    setAmount(0);
    const newPr = pullRequests.find(el=> el.id === value);
    if(newPr){
      setCurrentPullRequest(newPr)
    }
    getParticipantsPullRequest(value, githubId);
    handleInputColor("normal")
  }

  function recognizeAsFinished() {
    const recognizeAsFinished = addTransaction({type: TransactionTypes.recognizedAsFinish})
    dispatch(recognizeAsFinished);

    BeproService.network.getIssueByCID({issueCID: issueId})
                .then((_issue) => {
                  return BeproService.network.recognizeAsFinished({issueId: +_issue._id})
                })
                .then(txInfo => {
                  txWindow.updateItem(recognizeAsFinished.payload.id, BeproService.parseTransaction(txInfo, recognizeAsFinished.payload));
                })
                .then(() => {
                  if (handleBeproService)
                    handleBeproService(true);

                  if (handleMicroService)
                    handleMicroService(true);
                })
                .catch((e) => {
                  if (e?.message?.search(`User denied`) > -1)
                    dispatch(updateTransaction({...recognizeAsFinished.payload as any, remove: true}))
                  else dispatch(updateTransaction({...recognizeAsFinished.payload as any, status: TransactionStatus.failed}));
                  dispatch(toastWarning(t('bounty:errors.recognize-finished')));
                  console.error(`Failed to mark as finished`, e);
                })
  }

  function updateCreateProposalHideState() {
    if (!beproInit) return;

    BeproService.network.COUNCIL_AMOUNT().then(setCouncilAmount)
                .then(() => BeproService.network.isCouncil({address: currentAddress}))
                .then(isCouncil => setIsCouncil(isCouncil));
  }

  function renderRecognizeAsFinished() {
    return <Button onClick={recognizeAsFinished} className="mr-1">{t('bounty:actions.recognize-finished.title')}</Button>;
  }
  const cantBeMergeable = () => !currentPullRequest.isMergeable || currentPullRequest.merged;

  useEffect(() => {
    setAmount(sumObj(distrib));
  }, [distrib]);

  useEffect(() => {
    if (pullRequests.length && activeRepo){
      const defaultPr = pullRequests.find(el=> el.isMergeable) || pullRequests[0];
      setCurrentPullRequest(defaultPr)
      getParticipantsPullRequest(defaultPr?.id, defaultPr?.githubId);
      loadProposalsMeta()
    }
  }, [pullRequests, activeRepo]);

  useEffect(updateCreateProposalHideState, [currentAddress]);

  return (
    <div className="d-flex">
      {(isCouncil && isFinished && (
        <Button className="mx-2" onClick={() => setShow(true)}>
          Create Proposal
        </Button>
      )) ||
        (isIssueOwner && !isFinished && renderRecognizeAsFinished())}
      <Modal
        show={show}
        title={t('proposal:title')}
        titlePosition="center"
        onCloseClick={handleClose}
        footer={
          <>
            <Button
              onClick={handleClickCreate}
              disabled={
                !currentAddress ||
                participants.length === 0 ||
                !success ||
                cantBeMergeable()
              }
            >
              {!currentAddress ||
                participants.length === 0 ||
                (!success && (
                  <LockedIcon width={12} height={12} className="mr-1" />
                ))}
              <span>{t('proposal:actions.create')}</span>
            </Button>

            <Button color="dark-gray" onClick={handleClose}>
              {t('actions.cancel')}
            </Button>
          </>
        }
      >
        <p className="caption-small text-white-50 mb-2 mt-2">
          {t('pull-request:select')}
        </p>
        <ReactSelect
          id="pullRequestSelect"
          isDisabled={participants.length === 0}
          components={{
            Option: SelectOptionComponent,
            ValueContainer: SelectValueComponent
          }}
          placeholder={t('forms.select-placeholder')}
          defaultValue={{
            value: currentPullRequest?.id,
            label: `PR#${currentPullRequest?.id} ${t("misc.by")} @${
              currentPullRequest?.githubLogin
            }`,
            githubId: currentPullRequest?.githubId,
            githubLogin: currentPullRequest?.githubLogin,
            marged: currentPullRequest?.merged,
            isMergeable: currentPullRequest?.isMergeable,
            isDisable: false,
          }}
          options={pullRequests?.map((items: pullRequest) => ({
            value: items.id,
            label: `#${items.githubId} ${t("misc.by")} @${items.githubLogin}`,
            githubId: items.githubId,
            githubLogin: items.githubLogin,
            marged: items.merged,
            isMergeable: items.isMergeable,
            isDisable: items.merged || !items.isMergeable,
          }))}
          isOptionDisabled={(option) => option.isDisable}
          onChange={handleChangeSelect}
        />
        {(participants.length === 0 && (
          <p className="text-uppercase text-danger text-center w-100 caption mt-4 mb-0">
            {t('status.network-congestion')}
          </p>
        )) || (
          <>
            <p className="caption-small mt-3 text-white-50 text-uppercase mb-2 mt-3">
              {t("proposal:actions.propose-distribution")}
            </p>
            <ul className="mb-0">
              {participants.map((item) => (
                <CreateProposalDistributionItem
                  key={item.githubHandle}
                  by={item.githubHandle}
                  address={item.address}
                  onChangeDistribution={handleChangeDistrib}
                  defaultPercentage={0}
                  error={!!error}
                  success={success}
                  warning={warning}
                  isDisable={cantBeMergeable()}
                />
              ))}
            </ul>
            <div className="d-flex" style={{ justifyContent: "flex-end" }}>
              {warning || cantBeMergeable() ? (
                <p
                  className={`caption-small pr-3 mt-3 mb-0 text-uppercase text-${
                    warning ? "warning" : "danger"
                  }`}
                >
                  {t(
                    `proposal:errors.${
                      warning
                        ? "distribution-already-exists"
                        : "pr-cant-merged"
                    }`
                  )}
                </p>
              ) : (
                <p
                  className={clsx(
                    "caption-small pr-3 mt-3 mb-0  text-uppercase",
                    {
                      "text-success": success,
                      "text-danger": error,
                    }
                  )}
                >
                  {showExceptionalMessage && error ? t(`proposal:messages.distribution-cant-done`): t(
                    `proposal:messages.distribution-${
                      success ? "is" : "must-be"
                    }-100`
                  )}
                </p>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
