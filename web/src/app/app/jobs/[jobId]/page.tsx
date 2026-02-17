import JobDetailClient from "./JobDetailClient";

type JobParams = {
  jobId: string;
};

export default async function JobPage({
  params,
}: {
  params: Promise<JobParams>;
}) {
  const { jobId } = await params;
  return <JobDetailClient jobId={jobId} />;
}
