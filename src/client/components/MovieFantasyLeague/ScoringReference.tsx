import { useEffect, useState } from "react";
import apiService from "../../services/api";
import { MFLScoringMetric } from "../../types";

const ScoringReference = () => {
  const [scoringMetrics, setScoringMetrics] = useState<
    Record<string, MFLScoringMetric[]>
  >({});
  const getScoringReference = async () => {
    try {
      const response = await apiService.getMflScoringMetrics();
      if (response.data) {
        // group by metricName
        const groupedScoringMetrics = response.data.reduce(
          (acc: Record<string, MFLScoringMetric[]>, metric) => {
            const metricName = metric.metricName;
            if (!acc[metricName]) {
              acc[metricName] = [];
            }
            acc[metricName].push(metric);
            return acc;
          },
          {}
        );
        console.log(groupedScoringMetrics);
        setScoringMetrics(groupedScoringMetrics);
      }
    } catch (error) {
      console.error("Error fetching scoring reference:", error);
    }
  };

  useEffect(() => {
    getScoringReference();
  }, []);

  return (
    <div>
      <h1 className="text-center text-2xl font-bold">Scoring Reference</h1>
      <table className="table-auto mt-10 mx-auto">
        <thead>
          <tr>
            <th className="text-left">Scoring Metric</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(scoringMetrics).map(
            ([metricName, metrics]: [string, MFLScoringMetric[]]) => {
              const categories = metrics.map((metric) => {
                const categoryName =
                  metric.scoringCondition === "nomination" ||
                  metric.scoringCondition === "win" ||
                  metric.metricName === "metascore"
                    ? `${metric.category} (${metric.scoringCondition})`
                    : metric.category;
                return (
                  <tr className="last:pt-20">
                    <td className="px-4 py-1">{categoryName}</td>
                    <td className="text-right">{metric.pointValue}</td>
                  </tr>
                );
              });

              return (
                <>
                  <tr
                    key={metricName}
                    className="bg-letterboxd-bg-tertiary font-bold text-xl"
                  >
                    <td colSpan={2} className="py-4 px-2">
                      {metricName}
                    </td>
                  </tr>
                  {categories}
                </>
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ScoringReference;
