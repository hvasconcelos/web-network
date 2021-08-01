import { GetStaticProps } from "next";
import React, { useEffect, useState } from "react";
import IssueComments from "../components/issue-comments";
import IssueDescription from "../components/issue-description";
import IssueHero from "../components/issue-hero";
import IssueDraftProgress from "../components/issue-draft-progress";
import PageActions from "../components/page-actions";
import IssueProposals from "../components/issue-proposals";
import {
  mockNewIssues,
  mockReadyIssues,
  mockDeveloperIssues,
} from "../helpers/mockdata/mockIssues";
import { mockCommentsIssue } from "../helpers/mockdata/mockCommentsIssue";
import { IIssue } from "../components/issue-list-item";
import { useRouter } from "next/router";
import BeproService from "../services/bepro";
import { NetworkIssues } from "../helpers/mockdata/mockNetworkIssue";
import { isIssuesinDraft } from "../helpers/mockdata/mockIssueInDraft";
import GithubMicroService from "../services/github-microservice";

export default function PageIssue() {
  const router = useRouter();
  const { id } = router.query;

  const [issue, setIssue] = useState<IIssue>();
  const [networkIssue, setNetworkIssue] = useState<any>();
  const [isIssueinDraft, setIsIssueinDraft] = useState(false);
  const [commentsIssue, setCommentsIssue] = useState();
  const [userAddress, setUserAddress] = useState<any>();
  const [balance, setBalance] = useState();

  const getIssueNetwork = async () => {
    await BeproService.login();
    setNetworkIssue(
      await BeproService.network.getIssueById({
        issueId: id,
      })
    );
  };

  useEffect(() => {
    const gets = async () => {
      await BeproService.login();
      const address = await BeproService.getAddress();
      setUserAddress(address);

      setIssue(await GithubMicroService.getIssueId(id));
      console.log("id ->", id);

      const networkIssue = await BeproService.network.getIssueById({
        issueId: id,
      });
      setNetworkIssue(networkIssue);
      setBalance(await BeproService.network.getBEPROStaked());
      /*const testing01 = await BeproService.network.isIssueInDraft({
        issueId: id,
      });
      console.log("testing", testing01);*/
      if (issue) {
        const comments = await GithubMicroService.getCommentsIssue(
          issue.githubId
        );
        setCommentsIssue(comments);
      }
    };
    gets();
    //getBalance();
  }, []);

  return (
    <>
      <IssueHero issue={issue}></IssueHero>
      {issue?.state.toLowerCase() === "draft" && (
        <IssueDraftProgress
          amountTotal={balance}
          amountUsed={networkIssue?.tokensStaked}
        />
      )}
      <PageActions
        finalized={networkIssue?.finalized}
        isIssueinDraft={isIssueinDraft}
        userAddress={userAddress}
        issue={issue}
      />
      {issue?.state.toLocaleLowerCase() === "ready" && (
        <IssueProposals></IssueProposals>
      )}

      <IssueDescription description={issue?.body}></IssueDescription>
      <IssueComments url="/" comments={commentsIssue}></IssueComments>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
  };
};
