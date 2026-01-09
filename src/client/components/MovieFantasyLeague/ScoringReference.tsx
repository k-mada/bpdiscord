import { useEffect, useState } from "react";
import apiService from "../../services/api";
import { MFLScoringMetric } from "../../types";

const ScoringReference = () => {
  const [allScoringMetrics, setAllScoringMetrics] = useState<
    Record<string, MFLScoringMetric[]>
  >({});
  const [scoringMetrics, setScoringMetrics] = useState<
    Record<string, MFLScoringMetric[]>
  >({});
  const [showNominationsOnly, setShowNominationsOnly] = useState(false);
  const [showWinsOnly, setShowWinsOnly] = useState(false);

  const groupScoringMetrics = (
    metrics: MFLScoringMetric[]
  ): Record<string, MFLScoringMetric[]> => {
    return metrics.reduce((acc: Record<string, MFLScoringMetric[]>, metric) => {
      const metricName = metric.metricName;
      if (!acc[metricName]) {
        acc[metricName] = [];
      }
      acc[metricName].push(metric);
      return acc;
    }, {});
  };

  const getScoringReference = async () => {
    try {
      const response = await apiService.getMflScoringMetrics();
      if (response.data) {
        // group by metricName
        const groupedScoringMetrics = groupScoringMetrics(response.data);
        setAllScoringMetrics(groupedScoringMetrics);
        setScoringMetrics(groupedScoringMetrics);
      }
    } catch (error) {
      console.error("Error fetching scoring reference:", error);
    }
  };

  const applyFilters = (
    metrics: Record<string, MFLScoringMetric[]>,
    nominationsOnly: boolean,
    winsOnly: boolean
  ) => {
    let filtered = { ...metrics };

    // Filter individual metrics within each group, not just the groups
    if (nominationsOnly || winsOnly) {
      filtered = Object.fromEntries(
        Object.entries(filtered)
          .map(([metricName, metrics]) => {
            // Filter the metrics array within each group
            const filteredMetrics = metrics.filter((metric) => {
              if (nominationsOnly && winsOnly) {
                // Both checked: show nominations AND wins
                return (
                  metric.scoringCondition === "nomination" ||
                  metric.scoringCondition === "win"
                );
              } else if (nominationsOnly) {
                // Only nominations: show only nominations
                return metric.scoringCondition === "nomination";
              } else if (winsOnly) {
                // Only wins: show only wins
                return metric.scoringCondition === "win";
              }
              return true;
            });
            return [metricName, filteredMetrics];
          })
          .filter(([, metrics]) => metrics && metrics.length > 0) // Remove groups with no matching metrics
      );
    }

    return filtered;
  };

  const formatMetricName = (metricName: string) => {
    return (metricName = metricName.toLowerCase().replace(/ /g, "-"));
  };

  useEffect(() => {
    getScoringReference();
  }, []);

  const handleMetricSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const metricName = event.target.value;
    if (metricName) {
      const elementId = formatMetricName(metricName);
      // Use native browser hash navigation which respects user preferences
      window.location.hash = elementId;
    }
  };

  const handleFilterChange = (
    filterType: "nominations" | "wins",
    isChecked: boolean
  ) => {
    // Update the appropriate checkbox state
    if (filterType === "nominations") {
      setShowNominationsOnly(isChecked);
    } else {
      setShowWinsOnly(isChecked);
    }

    // Apply filters immediately with updated values
    const newNominationsOnly =
      filterType === "nominations" ? isChecked : showNominationsOnly;
    const newWinsOnly = filterType === "wins" ? isChecked : showWinsOnly;

    const filtered = applyFilters(
      allScoringMetrics,
      newNominationsOnly,
      newWinsOnly
    );
    setScoringMetrics(filtered);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-center text-2xl font-bold">Scoring Reference</h1>
      <div className="flex flex-col justify-center items-center mx-auto my-8">
        <label htmlFor="lstMetric" className="mr-8">
          Jump to a specific metric:
        </label>
        <select
          id="lstMetric"
          name="lstMetric"
          className="input-field w-fit"
          onChange={handleMetricSelect}
          defaultValue=""
        >
          <option value="" disabled>
            Select a metric...
          </option>
          {Object.entries(scoringMetrics).map(([metricName, metrics]) => {
            return (
              <option key={metricName} value={formatMetricName(metricName)}>
                {metricName}
              </option>
            );
          })}
        </select>
      </div>
      <div className="flex justify-center">
        <div className="flex items-center mx-4 pr-4 ps-4 bg-neutral-primary-soft border border-default rounded-lg  shadow-xs">
          <input
            id="bordered-checkbox-1"
            type="checkbox"
            value="nominations"
            name="bordered-checkbox"
            checked={showNominationsOnly}
            className="w-4 h-4 border border-default-medium rounded-xs bg-neutral-secondary-medium focus:ring-2 focus:ring-brand-soft"
            onChange={(e) =>
              handleFilterChange("nominations", e.target.checked)
            }
          />
          <label
            htmlFor="bordered-checkbox-1"
            className="select-none w-full py-4 ms-2 text-sm font-medium text-heading"
          >
            Show nominations only
          </label>
        </div>
        <div className="flex items-center mx-4 pr-4 ps-4 bg-neutral-primary-soft border border-default rounded-lg  shadow-xs">
          <input
            id="bordered-checkbox-2"
            type="checkbox"
            value="wins"
            name="bordered-checkbox"
            checked={showWinsOnly}
            className="w-4 h-4 border border-default-medium rounded-xs bg-neutral-secondary-medium focus:ring-2 focus:ring-brand-soft"
            onChange={(e) => handleFilterChange("wins", e.target.checked)}
          />
          <label
            htmlFor="bordered-checkbox-2"
            className="select-none w-full py-4 ms-2 text-sm font-medium text-heading"
          >
            Show wins only
          </label>
        </div>
      </div>
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
                    id={formatMetricName(metricName)}
                    className="bg-letterboxd-bg-tertiary font-bold text-xl scroll-mt-20"
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
